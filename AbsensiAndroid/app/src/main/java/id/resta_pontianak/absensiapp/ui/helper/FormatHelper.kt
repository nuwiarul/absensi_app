package id.resta_pontianak.absensiapp.ui.helper

import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

fun formatUtcIsoToLocal(isoUtc: String): String {
    return try {
        val instant = Instant.parse(isoUtc) // butuh format ...Z / RFC3339
        val zoned = instant.atZone(ZoneId.systemDefault())
        val fmt = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm", Locale("id", "ID"))
        zoned.format(fmt)
    } catch (_: Throwable) {
        isoUtc // fallback kalau gagal parse
    }
}

fun localizeCheckInMessage(msg: String): String {
    val regex = Regex("""\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z""")
    val m = regex.find(msg) ?: return msg
    val iso = m.value
    val local = formatUtcIsoToLocal(iso)
    return msg.replace(iso, local)
}





