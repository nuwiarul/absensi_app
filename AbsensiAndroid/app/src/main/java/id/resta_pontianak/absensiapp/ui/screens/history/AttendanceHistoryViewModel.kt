package id.resta_pontianak.absensiapp.ui.screens.history

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.ImageLoader
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.network.SelfieUrlProvider
import id.resta_pontianak.absensiapp.data.repo.AttendanceRepository
import id.resta_pontianak.absensiapp.ui.helper.DateRangeUtils
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.datetime.*
import javax.inject.Inject
import id.resta_pontianak.absensiapp.data.network.AttendanceSessionDto

@HiltViewModel
class AttendanceHistoryViewModel @Inject constructor(
    private val repo: AttendanceRepository,
    private val selfieUrlProvider: SelfieUrlProvider,
    val imageLoader: ImageLoader
) : ViewModel() {

    data class State(
        val from: LocalDate,
        val to: LocalDate,
        val isLoading: Boolean = false,
        val error: String? = null,
        val items: List<AttendanceSessionUi> = emptyList(),
        val selected: AttendanceSessionUi? = null,
        val photoKey: String? = null
    )

    private val tzDevice = TimeZone.currentSystemDefault()
    private val initialRange = DateRangeUtils.currentMonthRangeJakarta()

    private val _state = MutableStateFlow(State(from = initialRange.first, to = initialRange.second))
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        applyFilter() // auto load bulan berjalan
    }

    fun setFrom(date: LocalDate) = _state.update { it.copy(from = date) }
    fun setTo(date: LocalDate) = _state.update { it.copy(to = date) }

    fun resetToCurrentMonth() {
        val (f, t) = DateRangeUtils.currentMonthRangeJakarta()
        _state.update { it.copy(from = f, to = t) }
        applyFilter()
    }

    fun applyFilter() {
        val s = _state.value
        if (s.from > s.to) {
            _state.update { it.copy(error = "Tanggal 'Dari' tidak boleh lebih besar dari 'Sampai'") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(isLoading = true, error = null) }
            try {
                val list = repo.listAttendance(s.from.toString(), s.to.toString())
                val mapped = list.map { it.toUi(tzDevice) }
                    .sortedByDescending { it.workDate }

                _state.update { it.copy(isLoading = false, items = mapped) }
            } catch (e: Exception) {
                _state.update { it.copy(isLoading = false, error = e.message ?: "Gagal memuat riwayat") }
            }
        }
    }

    fun openDetail(item: AttendanceSessionUi) = _state.update { it.copy(selected = item) }
    fun closeDetail() = _state.update { it.copy(selected = null) }

    fun previewPhoto(key: String) = _state.update { it.copy(photoKey = key) }
    fun closePhoto() = _state.update { it.copy(photoKey = null) }

    fun consumeError() = _state.update { it.copy(error = null) }

    fun selfieUrl(key: String): String = selfieUrlProvider.build(key)
}

/** ---------- UI Model ---------- */
data class AttendanceSessionUi(
    val sessionId: String,
    val workDate: LocalDate,

    val fullName: String,
    val nrp: String,
    val satkerName: String,
    val satkerCode: String?,

    val checkInAtLocal: LocalDateTime?,
    val checkOutAtLocal: LocalDateTime?,

    val checkInSubtitle: String?,
    val checkOutSubtitle: String?,

    val checkInDistanceM: Double?,
    val checkOutDistanceM: Double?,

    val checkInLeaveNotes: String?,
    val checkOutLeaveNotes: String?,

    val checkInDeviceId: String?,
    val checkOutDeviceId: String?,
    val checkInDeviceName: String?,
    val checkOutDeviceName: String?,
    val checkInDeviceModel: String?,
    val checkOutDeviceModel: String?,

    val checkInSelfieKey: String?,
    val checkOutSelfieKey: String?
)

/** ---------- Mapper ---------- */
private fun parseIsoInstantOrNull(s: String?): Instant? =
    try { if (s == null) null else Instant.parse(s) } catch (_: Exception) { null }

private fun subtitle(leaveType: String?, geofenceName: String?): String? {
    val t = leaveType?.trim().orEmpty()
    return if (t.equals("NORMAL", ignoreCase = true)) geofenceName
    else if (t.isNotEmpty()) t else geofenceName
}

fun AttendanceSessionDto.toUi(timeZone: TimeZone): AttendanceSessionUi {
    val inInstant = parseIsoInstantOrNull(checkInAt)
    val outInstant = parseIsoInstantOrNull(checkOutAt)

    return AttendanceSessionUi(
        sessionId = sessionId,
        workDate = LocalDate.parse(workDate),

        fullName = fullName,
        nrp = nrp,
        satkerName = satkerName,
        satkerCode = satkerCode,

        checkInAtLocal = inInstant?.toLocalDateTime(timeZone),
        checkOutAtLocal = outInstant?.toLocalDateTime(timeZone),

        checkInSubtitle = subtitle(checkInLeaveType, checkInGeofenceName),
        checkOutSubtitle = subtitle(checkOutLeaveType, checkOutGeofenceName),

        checkInDistanceM = checkInDistanceM,
        checkOutDistanceM = checkOutDistanceM,

        checkInLeaveNotes = checkInLeaveNotes,
        checkOutLeaveNotes = checkOutLeaveNotes,

        checkInDeviceId = checkInDeviceId,
        checkOutDeviceId = checkOutDeviceId,
        checkInDeviceName = checkInDeviceName,
        checkOutDeviceName = checkOutDeviceName,
        checkInDeviceModel = checkInDeviceModel,
        checkOutDeviceModel = checkOutDeviceModel,

        checkInSelfieKey = checkInSelfieKey,
        checkOutSelfieKey = checkOutSelfieKey
    )
}
