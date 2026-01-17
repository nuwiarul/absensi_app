package id.resta_pontianak.absensiapp.ui.helper

import kotlinx.datetime.*

object LeaveDateRangeUtils {
    fun defaultRangeJakarta(): Pair<LocalDate, LocalDate> {
        val tz = TimeZone.of("Asia/Jakarta")
        val today = Clock.System.now().toLocalDateTime(tz).date
        val from = today.minus(DatePeriod(days = 7))
        val to = today.plus(DatePeriod(days = 7))
        return from to to
    }
}
