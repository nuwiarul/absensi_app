package id.resta_pontianak.absensiapp.ui.screens.dashboard
import id.resta_pontianak.absensiapp.data.network.AttendanceSessionTodayData
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class DashboardAttendanceUi(
    val headerDateText: String,
    val checkInDateText: String?,
    val checkInTimeText: String,
    val checkOutDateText: String?,
    val checkOutTimeText: String,
    val checkInEnabled: Boolean,
    val checkOutEnabled: Boolean,
    val isDuty: Boolean,
    val dutyStartText: String?, // localized datetime
    val dutyEndText: String?,   // localized datetime
)

private val LOCALE_ID = Locale("id", "ID")
private val HEADER_DATE_FMT = DateTimeFormatter.ofPattern("EEEE, dd MMM yyyy", LOCALE_ID)
private val DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy", LOCALE_ID)
private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm", LOCALE_ID)
private val DATETIME_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm", LOCALE_ID)

fun AttendanceSessionTodayData.toDashboardAttendanceUi(tz: ZoneId): DashboardAttendanceUi {
    val workDate = runCatching { LocalDate.parse(work_date) }.getOrNull() ?: LocalDate.now(tz)

    val checkInInstant = check_in_at?.let { runCatching { Instant.parse(it) }.getOrNull() }
    val checkOutInstant = check_out_at?.let { runCatching { Instant.parse(it) }.getOrNull() }

    val checkInLocal = checkInInstant?.atZone(tz)
    val checkOutLocal = checkOutInstant?.atZone(tz)

    val dutyStartLocal = duty_start_at?.let { runCatching { Instant.parse(it) }.getOrNull() }?.atZone(tz)
    val dutyEndLocal = duty_end_at?.let { runCatching { Instant.parse(it) }.getOrNull() }?.atZone(tz)

    val headerDateText = workDate.format(HEADER_DATE_FMT)

    val checkInDateText = checkInLocal?.format(DATE_FMT)
    val checkInTimeText = checkInLocal?.format(TIME_FMT) ?: "--:--"

    val checkOutDateText = checkOutLocal?.format(DATE_FMT)
    val checkOutTimeText = checkOutLocal?.format(TIME_FMT) ?: "--:--"

    val checkInEnabled = checkInInstant == null
    val checkOutEnabled = checkInInstant != null && checkOutInstant == null

    return DashboardAttendanceUi(
        headerDateText = headerDateText,
        checkInDateText = checkInDateText,
        checkInTimeText = checkInTimeText,
        checkOutDateText = checkOutDateText,
        checkOutTimeText = checkOutTimeText,
        checkInEnabled = checkInEnabled,
        checkOutEnabled = checkOutEnabled,
        isDuty = is_duty ?: false,
        dutyStartText = dutyStartLocal?.format(DATETIME_FMT),
        dutyEndText = dutyEndLocal?.format(DATETIME_FMT),
    )
}

fun AttendanceSessionTodayData?.toDashboardAttendanceUiSafe(tz: ZoneId): DashboardAttendanceUi {
    return this?.toDashboardAttendanceUi(tz)
        ?: DashboardAttendanceUi(
            headerDateText = LocalDate.now(tz).format(HEADER_DATE_FMT),
            checkInDateText = null,
            checkInTimeText = "--:--",
            checkOutDateText = null,
            checkOutTimeText = "--:--",
            checkInEnabled = true,
            checkOutEnabled = false,
            isDuty = false,
            dutyStartText = null,
            dutyEndText = null
        )
}
/*import id.resta_pontianak.absensiapp.data.network.AttendanceSessionTodayData
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

    val isDuty: Boolean,
    val dutyStartText: String?,  // "24 Jan 20:00"
    val dutyEndText: String?,    // "25 Jan 03:00"
)

private val LOCALE_ID = Locale("id", "ID")
private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm", LOCALE_ID)
private val DATE_FMT = DateTimeFormatter.ofPattern("EEEE, dd MMM yyyy", LOCALE_ID)
private val DATETIME_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm", LOCALE_ID)
private val DUTY_EDGE_FMT = DateTimeFormatter.ofPattern("dd MMM HH:mm", LOCALE_ID)

private fun parseUtcToZoned(utcIso: String?, zone: ZoneId) =
    try { if (utcIso.isNullOrBlank()) null else Instant.parse(utcIso).atZone(zone) } catch (_: Throwable) { null }

private fun formatUtcToLocalTime(utcIso: String?, zone: ZoneId): String? =
    parseUtcToZoned(utcIso, zone)?.format(TIME_FMT)

private fun formatUtcToLocalDateTime(utcIso: String?, zone: ZoneId): String? =
    parseUtcToZoned(utcIso, zone)?.format(DATETIME_FMT)

private fun formatUtcToDutyEdge(utcIso: String?, zone: ZoneId): String? =
    parseUtcToZoned(utcIso, zone)?.format(DUTY_EDGE_FMT)

private fun formatWorkDate(workDate: String?): String? {
    if (workDate.isNullOrBlank()) return null
    return try {
        LocalDate.parse(workDate).format(DATE_FMT)
    } catch (_: Throwable) {
        null
    }
}

fun mapToDashboardAttendanceUi(
    d: AttendanceSessionTodayData?,
    zone: ZoneId
): DashboardAttendanceUi {
    val isDuty = d?.is_duty == true

    val inTime = if (isDuty) {
        // duty: tampilkan tanggal + jam
        formatUtcToLocalDateTime(d?.check_in_at, zone) ?: "--:--"
    } else {
        formatUtcToLocalTime(d?.check_in_at, zone) ?: "--:--"
    }

    val outTime = formatUtcToLocalTime(d?.check_out_at, zone) ?: "--:--"

    // Untuk sekarang backend session-today belum kirim leave_type/geofence_name.
    // Subtitle kita buat generik, nanti bisa di-extend.
    val inSub = "Lokasi"
    val outSub = "Lokasi"

    val header = if (!d?.check_in_at.isNullOrBlank()) formatWorkDate(d?.work_date) else null

    return DashboardAttendanceUi(
        headerDateText = header,
        checkInTime = inTime,
        checkInSubtitle = inSub,
        checkOutTime = outTime,
        checkOutSubtitle = outSub,
        isDuty = isDuty,
        dutyStartText = formatUtcToDutyEdge(d?.duty_start_at, zone),
        dutyEndText = formatUtcToDutyEdge(d?.duty_end_at, zone),
    )
}*/


/*
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
*/
