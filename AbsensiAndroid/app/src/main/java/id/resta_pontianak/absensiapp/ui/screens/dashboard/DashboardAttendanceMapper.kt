package id.resta_pontianak.absensiapp.ui.screens.dashboard

import id.resta_pontianak.absensiapp.data.network.AttendanceGetData
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class DashboardAttendanceUi(
    val headerDateText: String?, // tampil hanya kalau check_in_at ada
    val checkInTime: String,
    val checkInSubtitle: String,
    val checkOutTime: String,
    val checkOutSubtitle: String,
)

private val LOCALE_ID = Locale("id", "ID")
private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm", LOCALE_ID)
private val DATE_FMT = DateTimeFormatter.ofPattern("EEEE, dd MMM yyyy", LOCALE_ID)

private fun formatUtcToLocalTime(utcIso: String?): String? {
    if (utcIso.isNullOrBlank()) return null
    return try {
        Instant.parse(utcIso).atZone(ZoneId.systemDefault()).format(TIME_FMT)
    } catch (_: Throwable) {
        null
    }
}

private fun formatWorkDate(workDate: String?): String? {
    if (workDate.isNullOrBlank()) return null
    return try {
        LocalDate.parse(workDate).format(DATE_FMT)
    } catch (_: Throwable) {
        null
    }
}

private fun locationText(leaveType: String?, geofenceName: String?): String {
    val lt = (leaveType ?: "NORMAL").uppercase()
    return if (lt == "NORMAL") {
        geofenceName ?: "Lokasi"
    } else {
        lt.replace('_', ' ') // DINAS_LUAR -> DINAS LUAR
    }
}

fun mapToDashboardAttendanceUi(d: AttendanceGetData?): DashboardAttendanceUi {
    val inTime = formatUtcToLocalTime(d?.check_in_at) ?: "--:--"
    val outTime = formatUtcToLocalTime(d?.check_out_at) ?: "--:--"

    val inLoc = locationText(d?.check_in_attendance_leave_type, d?.check_in_geofence_name)
    val outLoc = locationText(d?.check_out_attendance_leave_type, d?.check_out_geofence_name)

    // ✅ work_date tampil hanya kalau check_in_at ada
    val header = if (!d?.check_in_at.isNullOrBlank()) formatWorkDate(d?.work_date) else null

    return DashboardAttendanceUi(
        headerDateText = header,
        checkInTime = inTime,
        checkInSubtitle = inLoc,
        checkOutTime = outTime,
        checkOutSubtitle = outLoc
    )
}
