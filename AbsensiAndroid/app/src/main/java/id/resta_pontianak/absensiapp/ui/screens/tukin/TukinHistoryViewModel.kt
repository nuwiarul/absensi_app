package id.resta_pontianak.absensiapp.ui.screens.tukin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.network.TukinCalculationDto
import id.resta_pontianak.absensiapp.data.network.TukinDayDto
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import id.resta_pontianak.absensiapp.data.repo.TukinRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.Clock
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class TukinHistoryViewModel @Inject constructor(
    private val repo: TukinRepository,
    private val settingsRepo: SettingsRepository
) : ViewModel() {

    data class State(
        val month: String = "", // YYYY-MM
        val timezone: String = "Asia/Jakarta",
        val isLoading: Boolean = false,
        val error: String? = null,

        val calc: TukinCalculationDto? = null,
        val emptyHint: String? = null,

        val snack: String? = null
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    fun init(month: String) {
        if (_state.value.month.isNotBlank()) return
        _state.update { it.copy(month = month) }
        refresh()
    }

    fun setMonth(month: String) {
        _state.update { it.copy(month = month) }
        refresh()
    }

    fun refresh() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null, emptyHint = null) }
            try {
                val tzStr = settingsRepo.getTimezoneCached()
                val calc = repo.getCalculation(_state.value.month)

                if (calc == null) {
                    _state.update {
                        it.copy(
                            isLoading = false,
                            timezone = tzStr,
                            calc = null,
                            emptyHint = "Harus generate dulu, tolong tekan tombol Generate"
                        )
                    }
                } else {
                    _state.update { it.copy(isLoading = false, timezone = tzStr, calc = calc) }
                }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Gagal memuat tukin") }
            }
        }
    }

    fun generate() {
        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                repo.generate(_state.value.month, force = true)
                _state.update { it.copy(snack = "Generate berhasil") }
                refresh()
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Generate gagal") }
            }
        }
    }

    fun consumeSnack() = _state.update { it.copy(snack = null) }
}

internal enum class StatusKind { HADIR, TIDAK_HADIR, LEAVE, DUTY, OTHER }

internal data class StatusUi(
    val label: String,
    val kind: StatusKind
)

internal fun computeStatus(d: TukinDayDto): StatusUi {
    val leaveType = d.leave_type
    if (!leaveType.isNullOrBlank()) {
        if (leaveType == "DINAS_LUAR" && d.note == "DINASLUAR") {
            return StatusUi("DINAS LUAR", StatusKind.LEAVE)
        }
        return StatusUi(leaveType.replace('_', ' '), StatusKind.LEAVE)
    }

    if (d.is_duty_schedule) {
        val base = d.note ?: "DUTY SCHEDULE"
        val label = if (d.earned_credit == 0.0) "$base - TANPA ABSEN" else base
        return StatusUi(label, StatusKind.DUTY)
    }

    val note = d.note ?: ""
    if (note == "WORKDAY" || note == "HALFDAY") {
        if (!d.check_in_at.isNullOrBlank()) {
            val late = d.late_minutes
            return if (late != null && late > 0)
                StatusUi("HADIR - Telat $late m", StatusKind.HADIR)
            else
                StatusUi("HADIR", StatusKind.HADIR)
        }
        return StatusUi("TIDAK HADIR", StatusKind.TIDAK_HADIR)
    }

    return StatusUi(note.ifBlank { "UNKNOWN" }, StatusKind.OTHER)
}

internal fun formatTimeHHmm(isoZ: String?, tz: TimeZone): String {
    if (isoZ.isNullOrBlank()) return "-"
    return try {
        val inst = Instant.parse(isoZ)
        val ldt = inst.toLocalDateTime(tz)
        val hh = ldt.hour.toString().padStart(2, '0')
        val mm = ldt.minute.toString().padStart(2, '0')
        "$hh:$mm"
    } catch (_: Exception) {
        "-"
    }
}

internal fun todayLocalDate(tz: TimeZone): LocalDate {
    val now = Clock.System.now().toLocalDateTime(tz)
    return LocalDate.of(now.year, now.monthNumber, now.dayOfMonth)
}

internal fun filterUpToTodayAndExcludeHolidays(days: List<TukinDayDto>, tz: TimeZone): List<TukinDayDto> {
    val today = todayLocalDate(tz)
    return days.filter { d ->
        // ❌ jangan tampilkan HOLIDAY_IGNORED
        if (d.note == "HOLIDAY_IGNORED") return@filter false

        val okDate = runCatching { LocalDate.parse(d.work_date) <= today }.getOrElse { true }
        okDate
    }
}
