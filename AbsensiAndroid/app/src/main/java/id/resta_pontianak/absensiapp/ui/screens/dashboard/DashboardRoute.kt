package id.resta_pontianak.absensiapp.ui.screens.dashboard

import android.util.Log
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.ui.common.OnResumeEffect
import kotlinx.coroutines.launch

enum class AttendanceAction { CheckIn, CheckOut }

@Composable
fun DashboardRoute(
    tokenStore: TokenStore,
    onLogout: () -> Unit,
    onGoTunkin: () -> Unit,
    onGoSchedule: () -> Unit,
    onRiwayatAbsen: () -> Unit,
    onIjin: () -> Unit,
    onAnnouncements: () -> Unit,
    onGoAttendance: (type: AttendanceAction) -> Unit,
) {
    val scope = rememberCoroutineScope()

    var name by remember { mutableStateOf("-") }
    var nrp by remember { mutableStateOf("-") }
    var satkerName by remember { mutableStateOf("-") }

    val vm: DashboardViewModel = hiltViewModel()
    val s by vm.state.collectAsState()

    LaunchedEffect(Unit) {
        val p = tokenStore.getProfile()
        if (p != null) {
            name = p.fullName
            nrp = p.nrp
            satkerName = p.satkerName ?: "-"
        }
    }

    // ✅ reload tiap kali dashboard muncul lagi (balik dari map/liveness/success)
    OnResumeEffect {
        vm.load()
    }

    DashboardScreen(
        fullName = name,
        nrp = nrp,
        satkerName = satkerName,
        workDateText = s.workDateText,
        checkInDateText = s.checkInDateText,
        checkInTimeText = s.checkInTimeText,
        checkInEnabled = s.checkInEnabled,
        checkOutDateText = s.checkOutDateText,
        checkOutTimeText = s.checkOutTimeText,
        checkOutEnabled = s.checkOutEnabled,
        isDuty = s.isDuty,
        dutyStartText = s.dutyStartText,
        dutyEndText = s.dutyEndText,
        announcements =  s.announcements,
        onViewAllAnnouncements = onAnnouncements,
        dutyUpcoming = s.dutyUpcoming,
        announcementTitle = "Pengumuman!",
        announcementBody = "-",
        announcementDate = "Senin, 29 Des 2025",
        scheduleBody = "Jadwal Dinas Belum Tersedia, Silakan coba lagi nanti.",
        onClickMasuk = { onGoAttendance(AttendanceAction.CheckIn) },
        onClickKeluar = { onGoAttendance(AttendanceAction.CheckOut) },
        onClickTunkin = onGoTunkin,
        onClickSchedule = onGoSchedule,
        onClickIjin = onIjin,
        onClickRiwayatAbsen = onRiwayatAbsen,

        onLogoutClick = {
            scope.launch {
                Log.d("OnLogout", "logout clicked")
                tokenStore.clear()
                Log.d("OnLogout", "token after clear = ${tokenStore.getToken()}")
                onLogout()
            }
        }
    )
}