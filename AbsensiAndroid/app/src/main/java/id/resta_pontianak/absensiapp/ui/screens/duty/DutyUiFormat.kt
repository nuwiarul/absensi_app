import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

public val fmtId = DateTimeFormatter.ofPattern("d MMM yyyy", Locale("id", "ID"))

data class DutyRangeUi(
    val line1: String,
    val line2: String?
)

public fun dutyRangeUi(startIso: String, endIso: String, zoneId: ZoneId): DutyRangeUi {
    val start = java.time.Instant.parse(startIso).atZone(zoneId)
    val end = java.time.Instant.parse(endIso).atZone(zoneId)

    val sameDate = start.toLocalDate() == end.toLocalDate()

    val dateStart = start.toLocalDate().format(fmtId)
    val dateEnd = end.toLocalDate().format(fmtId)

    val timeStart = start.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm",
        Locale("id", "ID")
    ))
    val timeEnd = end.toLocalTime().format(DateTimeFormatter.ofPattern("HH:mm", Locale("id", "ID")))

    return if (sameDate) {
        DutyRangeUi(
            line1 = dateStart,
            line2 = "$timeStart–$timeEnd"
        )
    } else {
        DutyRangeUi(
            line1 = "$dateStart $timeStart",
            line2 = "↳ $dateEnd $timeEnd"
        )
    }
}
