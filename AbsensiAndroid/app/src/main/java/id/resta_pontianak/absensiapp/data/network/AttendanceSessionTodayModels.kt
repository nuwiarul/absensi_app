package id.resta_pontianak.absensiapp.data.network

data class AttendanceSessionTodayResp(
    val status: String,
    val data: AttendanceSessionTodayData?
)

data class AttendanceSessionTodayData(
    val work_date: String?, // "2026-01-24"

    val check_in_at: String?,  // ISO-8601 (UTC) dari backend
    val check_out_at: String?,

    val is_duty: Boolean?,

    val duty_start_at: String?, // ISO-8601 (UTC)
    val duty_end_at: String?,   // ISO-8601 (UTC)
)
