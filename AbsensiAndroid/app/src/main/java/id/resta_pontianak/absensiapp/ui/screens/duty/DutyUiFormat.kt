import java.time.LocalDate
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.time.format.DateTimeFormatter.ISO_INSTANT
import java.util.Locale

public val fmtId = DateTimeFormatter.ofPattern("d MMM yyyy", Locale("id", "ID"))

data class DutyRangeUi(
    val line1: String,
    val line2: String?
)

object DateRangeUtil {

    private val ISO = DateTimeFormatter.ISO_DATE

    fun currentToNextMonthRange(timezoneId: String): Pair<String, String> {
        val zone = runCatching { ZoneId.of(timezoneId) }
            .getOrElse { ZoneId.of("Asia/Jakarta") }

        val today = LocalDate.now(zone)

        // 1st day of current month 00:00:00 (local TZ)
        val startLocal = today
            .withDayOfMonth(1)
            .atStartOfDay(zone)

        // last day of next month 23:59:59 (local TZ)
        val nextMonth = today.plusMonths(1)
        val endLocal = nextMonth
            .withDayOfMonth(nextMonth.lengthOfMonth())
            .atTime(23, 59, 59)
            .atZone(zone)

        val startUtc = startLocal
            .withZoneSameInstant(ZoneOffset.UTC)
            .toInstant()

        val endUtc = endLocal
            .withZoneSameInstant(ZoneOffset.UTC)
            .toInstant()

        return ISO_INSTANT.format(startUtc) to ISO_INSTANT.format(endUtc)
    }
}

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
