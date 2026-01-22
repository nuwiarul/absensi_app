package id.resta_pontianak.absensiapp.ui.navigation

import android.net.Uri
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.navigation
import androidx.navigation.compose.rememberNavController
import id.resta_pontianak.absensiapp.data.auth.AuthEvent
import id.resta_pontianak.absensiapp.data.auth.AuthEventBus
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.repo.AuthRepository
import id.resta_pontianak.absensiapp.ui.screens.attendance.AttendanceErrorRoute
import id.resta_pontianak.absensiapp.ui.screens.attendance.AttendanceMapRoute
import id.resta_pontianak.absensiapp.ui.screens.attendance.AttendanceSuccessRoute
import id.resta_pontianak.absensiapp.ui.screens.attendance.LivenessRoute
import id.resta_pontianak.absensiapp.ui.screens.attendance.SharedAttendanceViewModel
import id.resta_pontianak.absensiapp.ui.screens.auth.LoginRoute
import id.resta_pontianak.absensiapp.ui.screens.dashboard.AttendanceAction
import id.resta_pontianak.absensiapp.ui.screens.dashboard.DashboardRoute
import java.net.URLDecoder
import android.widget.Toast
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.ui.platform.LocalContext
import id.resta_pontianak.absensiapp.ui.helper.localizeBackendMessage
import id.resta_pontianak.absensiapp.ui.screens.attendance.AttendanceLeaveRoute
import id.resta_pontianak.absensiapp.ui.screens.history.AttendanceHistoryRoute
import id.resta_pontianak.absensiapp.ui.screens.leave.LeaveRoute
import java.util.concurrent.atomic.AtomicBoolean

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.EventAvailable
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.navigation.NavDestination
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.navArgument
import id.resta_pontianak.absensiapp.ui.screens.account.AccountRoute
import id.resta_pontianak.absensiapp.ui.screens.duty.DutyScheduleRoute
import id.resta_pontianak.absensiapp.ui.screens.profile.ProfileRoute
import id.resta_pontianak.absensiapp.ui.screens.tukin.TukinHistoryRoute
import java.time.YearMonth
import id.resta_pontianak.absensiapp.ui.badges.LeaveBadgeViewModel

private val BottomNavBlue = Color(0xFF0B2A5A)


@Composable
fun AppNav(
    tokenStore: TokenStore,
) {


    val navController = rememberNavController()

    val context = LocalContext.current
    val unauthorizedGate = remember { AtomicBoolean(false) } // anti spam toast+navigate

    // status auto-login
    var startRoute by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) {
        val token = tokenStore.getToken()
        startRoute = if (token.isNullOrBlank()) Routes.Login else Routes.Dashboard
    }

    // Sambil cek token, tampilkan layar kosong/splash sederhana

    if (startRoute == null) {
        SplashScreen()
        return
    }

    LaunchedEffect(Unit) {
        AuthEventBus.events.collect { event ->
            when (event) {
                AuthEvent.Unauthorized -> {

                    // ✅ Kalau sudah di Login: cukup clear (optional), jangan toast+navigate berulang
                    if (navController.currentDestination?.route == Routes.Login) {
                        tokenStore.clear()
                        return@collect
                    }

                    // ✅ Anti spam: hanya handle sekali sampai di-reset
                    if (unauthorizedGate.compareAndSet(false, true)) {
                        Toast.makeText(
                            context,
                            "Sesi berakhir, silakan login ulang",
                            Toast.LENGTH_SHORT
                        ).show()

                        tokenStore.clear()

                        navController.navigate(Routes.Login) {
                            popUpTo(navController.graph.id) { inclusive = true }
                            launchSingleTop = true
                        }
                    }

                    /*
                    if (navController.currentDestination?.route != Routes.Login) {

                        // clear token
                        tokenStore.clear()

                        // pindah ke login & clear backstack
                        navController.navigate(Routes.Login) {
                            popUpTo(navController.graph.id) { inclusive = true }
                            launchSingleTop = true
                        }
                    } else {
                        // optional: tetap clear token biar aman (boleh pilih)
                        tokenStore.clear()
                    }

                     */
                }
            }
        }
    }


    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    val currentDestination = backStackEntry?.destination

    /*val showBottomBar = currentRoute != Routes.Login &&
            // hide juga saat sedang proses absen (map/liveness/error/success)
            (currentRoute?.startsWith(Routes.AttendanceGraph) != true) &&
            currentRoute != Routes.Profile*/

    val showBottomBar = isBottomBarVisible(currentRoute)
    val badgeVm: LeaveBadgeViewModel = hiltViewModel()
    val badgeState by badgeVm.state.collectAsState()
    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                BottomBar(
                    //currentRoute = currentRoute,
                    currentDestination = currentDestination,
                    submittedBadgeCount = badgeState.submittedCount,
                    onNavigate = { route ->
                        navController.navigate(route) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                )
            }
        }
    ) { innerPadding ->

        NavHost(
            navController = navController,
            startDestination = startRoute!!,
            modifier = Modifier
                .fillMaxSize()
                .then(if (showBottomBar) Modifier.padding(innerPadding) else Modifier)
        ) {
            composable(Routes.Login) {
                /*LoginRoute(
                    onLoginSuccess = navController::goToDashboardClearBackstack
                )*/
                LoginRoute(
                    onLoginSuccess = {
                        unauthorizedGate.set(false) // ✅ reset supaya bisa muncul lagi jika nanti expired lagi
                        navController.goToDashboardClearBackstack()
                    }
                )
            }

            composable(Routes.Dashboard) {
                DashboardRoute(
                    tokenStore = tokenStore,
                    onLogout = navController::goToLoginClearBackstack,
                    onGoTunkin = { /* nanti nav.navigate("tunkin") */ },
                    onGoSchedule = { /* nanti nav.navigate("schedule") */ },
                    onGoAttendance = { action ->
                        // nanti: nav ke halaman absen lokasi/selfie
                        // untuk sekarang bisa log/placeholder

                        if (action == AttendanceAction.CheckIn) {
                            navController.navigate(Routes.AttendanceMapCheckIn)
                        } else {
                            navController.navigate(Routes.AttendanceMapCheckOut)
                        }
                    },
                    onRiwayatAbsen = {
                        navController.navigate(Routes.AttendanceHistory)
                    },
                    onIjin = {
                        navController.navigate(Routes.Leave)
                    }

                )
            }

            composable(Routes.AttendanceHistory) {
                AttendanceHistoryRoute(onBack = { navController.popBackStack() })
            }

            composable(Routes.Leave) {
                LeaveRoute(onBack = { navController.popBackStack() })
            }

            composable(
                route = "${Routes.TukinHistory}?month={month}",
                arguments = listOf(
                    navArgument("month") {
                        type = NavType.StringType
                        defaultValue = YearMonth.now().toString()
                    }
                )
            ) { backStackEntry ->
                val month = backStackEntry.arguments?.getString("month") ?: YearMonth.now().toString()
                TukinHistoryRoute(
                    onBack = { navController.popBackStack() },
                    initialMonth = month
                )
            }

            // ✅ Attendance nested graph (Shared VM scoped di sini)

            // ✅ NEW: Akun tab
            composable(Routes.Account) {
                AccountRoute(
                    tokenStore = tokenStore,
                    onInformasiProfil = { navController.navigate(Routes.Profile) },
                    onRiwayatPerizinan = {
                        navController.navigate(Routes.Leave) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onRiwayatKehadiran = {
                        navController.navigate(Routes.AttendanceHistory) {
                            popUpTo(navController.graph.findStartDestination().id) {
                                saveState = true
                            }
                            launchSingleTop = true
                            restoreState = true
                        }
                    },
                    onRiwayatTunkin = {
                        val m = YearMonth.now().toString()
                        navController.navigate("${Routes.TukinHistory}?month=$m")
                    },
                    onJadwalDinas = { navController.navigate(Routes.DutySchedules) },
                    onLogout = navController::goToLoginClearBackstack
                )
            }

            composable(Routes.Profile) { // ✅ ADD
                ProfileRoute(
                    onBack = { navController.popBackStack() }
                )
            }

            composable(Routes.DutySchedules) {
                DutyScheduleRoute(
                    onBack = { navController.popBackStack() }
                )
            }


            navigation(
                startDestination = "${Routes.AttendanceGraph}/${Routes.AttendanceMap}/{action}",
                route = Routes.AttendanceGraph
            ) {
                composable("${Routes.AttendanceGraph}/${Routes.AttendanceMap}/{action}") { backStackEntry ->
                    val a = backStackEntry.arguments?.getString("action") ?: "in"
                    val action =
                        if (a == "out") AttendanceAction.CheckOut else AttendanceAction.CheckIn

                    AttendanceMapRoute(
                        navController = navController,   // ✅ pass navController
                        backStackEntry = backStackEntry,   // ✅ tambah ini
                        action = action,
                        onCancel = { navController.popBackStack() },
                        onContinue = {
                            navController.navigate("${Routes.AttendanceGraph}/${Routes.Liveness}")
                        },
                        onContinueLeave = {
                            navController.navigate("${Routes.AttendanceGraph}/${Routes.AttendanceLeave}")
                        }
                    )
                }

                composable("${Routes.AttendanceGraph}/${Routes.Liveness}") { backStackEntry ->
                    LivenessRoute(
                        navController = navController,   // ✅ pass navController
                        backStackEntry = backStackEntry,   // ✅ tambah ini
                        onBack = { navController.popBackStack() },
                        onDone = {
                            // selesai absensi → balik ke dashboard
                            navController.popBackStack(Routes.Dashboard, inclusive = false)
                        }
                    )
                }

                composable("${Routes.AttendanceGraph}/${Routes.AttendanceError}/{msg}") { backStackEntry ->

                    val parentEntry = remember(backStackEntry) {
                        navController.getBackStackEntry(Routes.AttendanceGraph)
                    }

                    val shared: SharedAttendanceViewModel = hiltViewModel(parentEntry)

                    val raw = backStackEntry.arguments?.getString("msg") ?: "Terjadi kesalahan"
                    //val msg = URLDecoder.decode(raw, "UTF-8")
                    val msg = Uri.decode(raw)
                    val displayMsg = remember(msg) { localizeBackendMessage(msg) }

                    AttendanceErrorRoute(
                        message = displayMsg,
                        onRetry = {
                            // kembali ke map: cukup pop sampai map screen
                            /*navController.popBackStack(
                                route = "${Routes.AttendanceGraph}/${Routes.AttendanceMap}/{action}",
                                inclusive = false
                            )*/

                            // 1) set trigger refresh
                            shared.requestRefreshLocation()

                            // 2) balik ke map (pop error screen)
                            navController.popBackStack()
                            // sekarang user kembali ke Liveness (karena error screen dipush dari Liveness)
                            // kita pop sekali lagi biar balik ke Map:
                            navController.popBackStack()
                        },
                        onToDashboard = {
                            navController.popBackStack(Routes.Dashboard, inclusive = false)
                        }
                    )
                }

                composable("${Routes.AttendanceGraph}/${Routes.AttendanceSuccess}") { backStackEntry ->
                    val parentEntry = remember(backStackEntry) {
                        navController.getBackStackEntry(Routes.AttendanceGraph)
                    }
                    val shared: SharedAttendanceViewModel = hiltViewModel(parentEntry)
                    val s by shared.state.collectAsState()

                    AttendanceSuccessRoute(
                        action = s.action,
                        result = s.lastResult,
                        onToDashboard = { navController.popBackStack(Routes.Dashboard, false) },
                        onBackToDashboard = { navController.popBackStack(Routes.Dashboard, false) }
                    )
                }

                composable("${Routes.AttendanceGraph}/${Routes.AttendanceLeave}") { backStackEntry ->
                    val parentEntry = remember(backStackEntry) {
                        navController.getBackStackEntry(Routes.AttendanceGraph)
                    }
                    val shared: SharedAttendanceViewModel = hiltViewModel(parentEntry)

                    AttendanceLeaveRoute(
                        shared = shared,
                        onCancel = { navController.popBackStack(Routes.Dashboard, false) },
                        onContinue = { navController.navigate("${Routes.AttendanceGraph}/${Routes.Liveness}") },
                        onBack = {
                            navController.popBackStack()
                        }

                    )
                }
            }


        }
    }


}

@Composable
private fun SplashScreen() {
    // simple saja dulu
    androidx.compose.material3.Surface(
        modifier = androidx.compose.ui.Modifier.fillMaxSize(),
        color = androidx.compose.material3.MaterialTheme.colorScheme.background
    ) {
        androidx.compose.foundation.layout.Box(
            modifier = androidx.compose.ui.Modifier.fillMaxSize(),
            contentAlignment = androidx.compose.ui.Alignment.Center
        ) {
            androidx.compose.material3.CircularProgressIndicator()
        }
    }
}


@Composable
private fun BottomBar(
    currentDestination: NavDestination?,
    submittedBadgeCount: Int,
    onNavigate: (String) -> Unit
) {


    val items = listOf(
        Triple(Routes.Dashboard, "Dashboard", Icons.Filled.Dashboard),
        Triple(Routes.AttendanceHistory, "Hadir", Icons.Filled.EventAvailable),
        Triple(Routes.Leave, "Ijin", Icons.Filled.Description),
        Triple(Routes.Account, "Akun", Icons.Filled.AccountCircle),
    )

    NavigationBar(
        containerColor = BottomNavBlue,
        tonalElevation = 8.dp
    ) {
        items.forEach { (route, label, icon) ->
            //val selected = currentRoute == route

            /* val selected = when (route) {
                 Routes.Account -> currentRoute == Routes.Account || currentRoute == Routes.Profile // ✅ CHANGE
                 else -> currentRoute == route
             }*/

            val selected = currentDestination?.hierarchy?.any { it.route == route } == true
            val tint = if (selected) Color.White else Color.White.copy(alpha = 0.7f)

            NavigationBarItem(
                selected = selected,
                onClick = { onNavigate(route) },
                icon = {
                    /*Icon(
                        imageVector = icon,
                        contentDescription = label,
                        tint = if (selected) Color.White else Color.White.copy(alpha = 0.7f)
                    )*/


                    // Badge hanya untuk tab Ijin: jumlah leave SUBMITTED (±7 hari)
                    if (route == Routes.Leave && submittedBadgeCount > 0) {
                        BadgedBox(
                            badge = {
                                Badge(
                                    containerColor = Color(0xFFE53935)
                                ) {
                                    Text(
                                        text = submittedBadgeCount.coerceAtMost(99).toString(),
                                        color = Color.White
                                    )
                                }
                            }
                        ) {
                            Icon(imageVector = icon, contentDescription = label, tint = tint)
                        }
                    } else {
                        Icon(imageVector = icon, contentDescription = label, tint = tint)
                    }
                },
                label = {
                    Text(
                        text = label,
                        color = if (selected) Color.White else Color.White.copy(alpha = 0.7f)
                    )
                },
                colors = NavigationBarItemDefaults.colors(
                    indicatorColor = Color.White.copy(alpha = 0.15f)
                )
            )
        }
    }
}


private fun NavHostController.goToDashboardClearBackstack() {
    navigate(Routes.Dashboard) {
        popUpTo(Routes.Login) { inclusive = true }
        launchSingleTop = true
    }
}

private fun NavHostController.goToLoginClearBackstack() {
    navigate(Routes.Login) {
        popUpTo(graph.id) { inclusive = true }
        launchSingleTop = true
    }
}

private fun isBottomBarVisible(route: String?): Boolean {
    if (route.isNullOrBlank()) return false

    // hide di login
    if (route == Routes.Login) return false

    // hide di flow absensi
    if (route.startsWith(Routes.AttendanceGraph)) return false

    if (route.startsWith(Routes.TukinHistory)) return false

    // ✅ hide di screen full page (tanpa bottom nav)
    if (route in setOf(
            Routes.Profile, // Informasi Profil
            Routes.DutySchedules, // Jadwal Dinas
            // nanti bisa tambah: Routes.ChangePasswordScreen, dll,
        )
    ) return false

    return true
}