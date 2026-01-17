package id.resta_pontianak.absensiapp.ui.helper

import kotlinx.datetime.*

object DateRangeUtils {
    fun currentMonthRangeJakarta(): Pair<LocalDate, LocalDate> {
        val tz = TimeZone.of("Asia/Jakarta")
        val today = Clock.System.now().toLocalDateTime(tz).date
        val first = LocalDate(today.year, today.monthNumber, 1)
        val last = first.plus(DatePeriod(months = 1)).minus(DatePeriod(days = 1))
        return first to last
    }
}