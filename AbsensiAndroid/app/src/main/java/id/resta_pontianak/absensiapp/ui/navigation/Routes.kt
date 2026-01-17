package id.resta_pontianak.absensiapp.ui.navigation

object Routes {
    const val Login = "login"
    const val Dashboard = "dashboard"
    const val AttendanceMap = "attendance_map"
    // ✅ parent graph untuk share VM
    const val AttendanceGraph = "attendance_graph"
    const val AttendanceMapCheckIn = "$AttendanceGraph/$AttendanceMap/in"
    const val AttendanceMapCheckOut = "$AttendanceGraph/$AttendanceMap/out"
    const val Liveness = "liveness"

    const val AttendanceError = "attendance_error"

    const val AttendanceSuccess = "attendance_success"

    const val AttendanceLeave = "attendance_leave"

    const val AttendanceHistory = "attendance_history"

    const val Leave = "leave"
}