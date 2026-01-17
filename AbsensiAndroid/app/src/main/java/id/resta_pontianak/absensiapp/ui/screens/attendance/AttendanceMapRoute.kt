package id.resta_pontianak.absensiapp.ui.screens.attendance

import android.Manifest
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContract
import androidx.activity.result.contract.ActivityResultContracts
import androidx.collection.arrayMapOf
import androidx.collection.intSetOf
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavHostController
import id.resta_pontianak.absensiapp.data.constant.LeaveType
import id.resta_pontianak.absensiapp.ui.navigation.Routes
import id.resta_pontianak.absensiapp.ui.screens.dashboard.AttendanceAction
import kotlinx.coroutines.delay

@Composable
fun AttendanceMapRoute(
    navController: NavHostController,
    backStackEntry: NavBackStackEntry,  // ✅ tambah
    action: AttendanceAction,
    onCancel: () -> Unit,
    onContinue: () -> Unit,
    onContinueLeave: () -> Unit
) {
    val vm: AttendanceMapViewModel = hiltViewModel()
    // ✅ Shared VM scoped ke attendance_graph
    val parentEntry = remember(backStackEntry) {
        navController.getBackStackEntry(Routes.AttendanceGraph)
    }
    val shared: SharedAttendanceViewModel = hiltViewModel(parentEntry)
    val sharedState by shared.state.collectAsState()
    val state by vm.state.collectAsState()

    LaunchedEffect(sharedState.triggerRefreshLocation) {
        if (sharedState.triggerRefreshLocation) {
            vm.refreshLocation()
            // kalau kamu mau sekaligus load ulang geofence, boleh:
            // vm.load()

            shared.consumeRefreshLocationTrigger()
        }
    }

    LaunchedEffect(action) {
        shared.setAction(action)
    }

    // setiap lokasi update, simpan ke shared
    LaunchedEffect(
        state.userLat, state.userLon, state.accuracyM, state.isMock,
        state.provider,
        state.locationAgeMs
    ) {
        val lat = state.userLat
        val lon = state.userLon
        if (lat != null && lon != null) {
            shared.setLocation(
                lat,
                lon,
                acc = state.accuracyM,
                isMock = state.isMock,
                provider = state.provider,
                ageMs = state.locationAgeMs
            )
        }
    }

    LaunchedEffect(Unit) {
        // trigger refresh periodik sampai kondisi ready terpenuhi
        while (true) {
            vm.refreshLocation()
            delay(2000)

            val ready = (state.userLat != null && state.userLon != null) &&
                    ((state.accuracyM ?: Double.MAX_VALUE) <= 50.0)

            if (ready) break
        }
    }

    // permission request
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { grants ->

        val ok = (grants[Manifest.permission.ACCESS_FINE_LOCATION] == true) ||
                (grants[Manifest.permission.ACCESS_COARSE_LOCATION] == true)
        if (ok) vm.refreshLocation()
    }

    LaunchedEffect(Unit) {
        vm.load()
        permissionLauncher.launch(
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    AttendanceMapScreen(
        state = state,
        distanceText = vm.distanceText(),
        onRetry = { vm.load() },
        onRefreshLocation = { vm.refreshLocation() },
        onCancel = onCancel,
        onContinue = {
            val inside = state.insideArea == true
            if (inside) {
                shared.setLeave(LeaveType.NORMAL, null)
                onContinue()
            } else {
                onContinueLeave()
            }
        },
        onBack = onCancel
    )
}