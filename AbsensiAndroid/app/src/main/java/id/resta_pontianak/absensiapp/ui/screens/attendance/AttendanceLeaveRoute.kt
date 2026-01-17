package id.resta_pontianak.absensiapp.ui.screens.attendance

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import id.resta_pontianak.absensiapp.data.constant.LeaveType

@Composable
fun AttendanceLeaveRoute(
    shared: SharedAttendanceViewModel,
    onCancel: () -> Unit,
    onBack: () -> Unit,
    onContinue: () -> Unit
) {
    val s by shared.state.collectAsState()

    val initType = if (s.leaveType == LeaveType.NORMAL) LeaveType.DINAS_LUAR else s.leaveType

    AttendanceLeaveScreen(
        initialType = initType,
        initialNotes = s.leaveNotes.orEmpty(),
        onCancel = {
            // optional reset
            shared.setLeave(LeaveType.NORMAL, null)
            onCancel()
        },
        onContinue = { type, notes ->
            shared.setLeave(type, notes.takeIf { it.isNotBlank() })
            onContinue()
        },
        onBack = {
            onBack()
        }
    )
}
