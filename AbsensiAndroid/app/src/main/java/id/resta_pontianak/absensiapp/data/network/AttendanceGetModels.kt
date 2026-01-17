package id.resta_pontianak.absensiapp.data.network

data class AttendanceGetResp(
    val status: String,
    val data: AttendanceGetData?
)

data class AttendanceGetData(
    val work_date: String?, // "2026-01-17"

    val check_in_at: String?,  // "2026-01-17T04:55:31.032734Z"
    val check_out_at: String?,

    val check_in_geofence_name: String?,
    val check_out_geofence_name: String?,

    val check_in_attendance_leave_type: String?, // NORMAL / WFH / WFA / DINAS_LUAR / IJIN / SAKIT
    val check_out_attendance_leave_type: String?,

    val check_in_attendance_leave_notes: String?,
    val check_out_attendance_leave_notes: String?,
)