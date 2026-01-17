package id.resta_pontianak.absensiapp.ui.helper
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val ID_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy HH:mm", Locale("id","ID"))

fun localizeBackendMessage(msg: String): String {
    val regex = Regex("""\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}""")
    val m = regex.find(msg) ?: return msg

    val ts = m.value
    val local = try {
        val odt = OffsetDateTime.parse(ts)
        android.util.Log.d("TZ", "zone=" + ZoneId.systemDefault().id)
        odt.atZoneSameInstant(ZoneId.systemDefault()).format(ID_FMT)
    } catch (_: Throwable) {
        ts
    }

    return msg.replace(ts, local)
}
