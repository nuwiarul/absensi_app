package id.resta_pontianak.absensiapp.ui.screens.duty

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DATE_FMT = DateTimeFormatter.ofPattern("d MMM yyyy", Locale("id", "ID"))
private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm", Locale("id", "ID"))

fun formatDateId(isoUtc: String, zoneId: ZoneId): String {
    val zdt = Instant.parse(isoUtc).atZone(zoneId)
    return zdt.format(DATE_FMT)
}

fun formatTimeOnly(isoUtc: String, zoneId: ZoneId): String {
    val zdt = Instant.parse(isoUtc).atZone(zoneId)
    return zdt.format(TIME_FMT)
}
