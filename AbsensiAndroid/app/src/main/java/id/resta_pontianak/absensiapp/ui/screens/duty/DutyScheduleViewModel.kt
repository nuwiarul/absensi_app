package id.resta_pontianak.absensiapp.ui.screens.duty

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.CreateDutyScheduleReq
import id.resta_pontianak.absensiapp.data.network.DutyScheduleModels
import id.resta_pontianak.absensiapp.data.network.DutyScheduleRequestDto
import id.resta_pontianak.absensiapp.data.repo.DutyScheduleRepository
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import id.resta_pontianak.absensiapp.ui.helper.apiErrorMessage
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId
import java.time.ZonedDateTime

@HiltViewModel
class DutyScheduleViewModel @javax.inject.Inject constructor(
    private val repo: DutyScheduleRepository,
    private val settingsRepo: SettingsRepository,
    private val tokenStore: TokenStore
) : ViewModel() {

    // role dari TokenStore (dipakai buat menentukan tombol aksi)
    var myRole by mutableStateOf<String?>(null)
        private set

    val isSatkerHead: Boolean
        get() = myRole?.equals("SATKER_HEAD", ignoreCase = true) == true

    val isMember: Boolean
        get() = myRole?.equals("MEMBER", ignoreCase = true) == true

    init {
        // load sekali dari local storage (tidak perlu hit backend)
        viewModelScope.launch {
            myRole = tokenStore.getProfile()?.role
        }
    }

    var schedules by mutableStateOf<List<DutyScheduleModels>>(emptyList())
        private set

    var requests by mutableStateOf<List<DutyScheduleRequestDto>>(emptyList())
        private set

    var loading by mutableStateOf(false)
        private set

    var error by mutableStateOf<String?>(null)
        private set


    var selectedStatus by mutableStateOf("SUBMITTED")
        private set

    // dialog state
    var showCreateDialog by mutableStateOf(false)
        private set

    fun updateShowCreateDialog(v: Boolean) { showCreateDialog = v }

    fun updateSelectedStatus(v: String) {
        selectedStatus = v
    }

    var createError by mutableStateOf<String?>(null)
        private set

    fun clearCreateError() { createError = null }


    // ✅ range state untuk UI filter
    var rangeFrom by mutableStateOf<LocalDate?>(null)
        private set

    var rangeTo by mutableStateOf<LocalDate?>(null)
        private set

    private suspend fun getZoneId(): ZoneId {
        val tz = settingsRepo.getTimezoneCached()
        return runCatching { ZoneId.of(tz) }.getOrElse { ZoneId.of("Asia/Jakarta") }
    }

    private fun defaultRangeLocal(nowLocal: LocalDate): Pair<LocalDate, LocalDate> {
        // flow: tanggal 1 bulan berjalan -> tanggal terakhir bulan depan
        val thisYm = YearMonth.of(nowLocal.year, nowLocal.monthValue)
        val nextYm = thisYm.plusMonths(1)

        val from = LocalDate.of(thisYm.year, thisYm.monthValue, 1)
        val to = LocalDate.of(nextYm.year, nextYm.monthValue, nextYm.lengthOfMonth())
        return from to to
    }

    fun initDefaultRangeIfNeeded() = viewModelScope.launch {
        if (rangeFrom != null && rangeTo != null) return@launch
        val zone = getZoneId()
        val nowLocal = ZonedDateTime.now(zone).toLocalDate()
        val (f, t) = defaultRangeLocal(nowLocal)
        rangeFrom = f
        rangeTo = t
    }

    fun setRange(from: LocalDate, to: LocalDate) {
        rangeFrom = from
        rangeTo = to
        refreshSchedules()
    }

    fun resetRangeToDefault() = viewModelScope.launch {
        val zone = getZoneId()
        val nowLocal = ZonedDateTime.now(zone).toLocalDate()
        val (f, t) = defaultRangeLocal(nowLocal)
        rangeFrom = f
        rangeTo = t
        refreshSchedules()
    }

    private suspend fun getRangeUtcIso(): Pair<String, String> {
        val zone = getZoneId()
        val nowLocal = ZonedDateTime.now(zone).toLocalDate()

        val (fromDate, toDate) = if (rangeFrom != null && rangeTo != null) {
            rangeFrom!! to rangeTo!!
        } else {
            defaultRangeLocal(nowLocal)
        }

        val fromUtc = fromDate.atStartOfDay(zone).withZoneSameInstant(ZoneId.of("UTC"))
        val toUtc = toDate.atTime(23, 59, 59).atZone(zone).withZoneSameInstant(ZoneId.of("UTC"))

        return fromUtc.toInstant().toString() to toUtc.toInstant().toString()
    }

    fun refreshSchedules() = viewModelScope.launch {
        loading = true
        error = null
        try {
            val (from, to) = getRangeUtcIso()
            val list = repo.listDutySchedules(from, to)

            // ✅ sort terbaru dulu berdasarkan start_at
            schedules = list.sortedByDescending {
                runCatching { Instant.parse(it.start_at) }.getOrNull()
            }
        } catch (e: Exception) {
            error = apiErrorMessage(e)
        } finally {
            loading = false
        }
    }

    fun refreshRequests() = viewModelScope.launch {
        loading = true
        error = null
        try {
            val (from, to) = getRangeUtcIso()
            val list = repo.listDutyScheduleRequests(selectedStatus, from, to)

            // optional: sort terbaru dulu juga
            requests = list.sortedByDescending {
                runCatching { Instant.parse(it.start_at) }.getOrNull()
            }
        } catch (e: Exception) {
            error = apiErrorMessage(e)
        } finally {
            loading = false
        }
    }

    fun submitRequest(
        startLocal: ZonedDateTime,
        endLocal: ZonedDateTime,
        scheduleType: String,
        title: String?,
        note: String?,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) = viewModelScope.launch {
        loading = true
        error = null
        createError = null
        try {
            val startUtc = startLocal.withZoneSameInstant(ZoneId.of("UTC")).toInstant().toString()
            val endUtc = endLocal.withZoneSameInstant(ZoneId.of("UTC")).toInstant().toString()

            repo.createDutyScheduleRequest(
                CreateDutyScheduleReq(
                    start_at = startUtc,
                    end_at = endUtc,
                    schedule_type = scheduleType,
                    title = title?.takeIf { it.isNotBlank() },
                    note = note?.takeIf { it.isNotBlank() }
                )
            )
            showCreateDialog = false
            refreshRequests()
            onSuccess("Berhasil mengajukan jadwal dinas")
        } catch (e: Exception) {
            val msg = apiErrorMessage(e)
            createError = msg
            onError(msg)
        } finally {
            loading = false
        }
    }

    fun cancelRequest(
        id: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) = viewModelScope.launch {
        loading = true
        error = null
        try {
            repo.cancelDutyScheduleRequest(id)
            refreshRequests()
            onSuccess("Berhasil membatalkan pengajuan")
        } catch (e: Exception) {
            onError(apiErrorMessage(e))
        } finally {
            loading = false
        }
    }

    fun approveRequest(
        id: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) = viewModelScope.launch {
        // hanya SATKER_HEAD yang boleh approve
        if (!isSatkerHead) {
            onError("forbidden")
            return@launch
        }
        loading = true
        error = null
        try {
            repo.approveDutyScheduleRequest(id)
            refreshRequests()
            onSuccess("Berhasil approve")
        } catch (e: Exception) {
            onError(apiErrorMessage(e))
        } finally {
            loading = false
        }
    }

    fun rejectRequest(
        id: String,
        reason: String,
        onSuccess: (String) -> Unit,
        onError: (String) -> Unit
    ) = viewModelScope.launch {
        if (!isSatkerHead) {
            onError("forbidden")
            return@launch
        }
        loading = true
        error = null
        try {
            repo.rejectDutyScheduleRequest(id, reason)
            refreshRequests()
            onSuccess("Berhasil reject")
        } catch (e: Exception) {
            onError(apiErrorMessage(e))
        } finally {
            loading = false
        }
    }

    suspend fun zoneIdForUi(): ZoneId = getZoneId()
}
