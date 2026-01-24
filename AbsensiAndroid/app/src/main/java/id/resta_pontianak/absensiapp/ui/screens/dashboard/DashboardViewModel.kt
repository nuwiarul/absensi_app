package id.resta_pontianak.absensiapp.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dutyRangeUi
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.AnnouncementDto
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import javax.inject.Inject

data class DashboardAnnouncementUi(
    val id: String,
    val title: String,
    val dateLabel: String,
    val body: String,
    val scope: String, // "GLOBAL" | "SATKER"
)

data class DashboardDutyUi(
    val id: String,
    val startAt: String,
    val endAt: String,
    val scheduleType: String, // REGULAR | SHIFT | ON_CALL | SPECIAL
    val title: String?,
    val note: String?,
    val line1: String,        // hasil dutyRangeUi().line1
    val line2: String?        // hasil dutyRangeUi().line2
)

data class DashboardUiState(
    val loading: Boolean = false,
    val error: String? = null,

    val fullName: String = "-",
    val nrp: String = "-",

    val workDateText: String? = null,

    val checkInDateText: String? = null,
    val checkInTimeText: String = "--:--",
    val checkOutDateText: String? = null,
    val checkOutTimeText: String = "--:--",

    val checkInEnabled: Boolean = true,
    val checkOutEnabled: Boolean = false,

    val isDuty: Boolean = false,
    val dutyStartText: String? = null,
    val dutyEndText: String? = null,


    val announcements: List<DashboardAnnouncementUi> = emptyList(),
    val dutyUpcoming: List<DashboardDutyUi> = emptyList(),
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
    private val settingsRepository: SettingsRepository
) : ViewModel() {

    private val _state = MutableStateFlow(DashboardUiState())
    val state: StateFlow<DashboardUiState> = _state

    private var loadingNow = false

    fun load() {
        if (loadingNow) return
        loadingNow = true
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }

            try {
                // profile dari tokenStore (kamu sudah punya)
                val profile = tokenStore.getProfile()
                    ?: error("Profile tidak ditemukan, silakan login ulang")


                val tzName = settingsRepository.getTimezoneCached()
                val zone = runCatching { ZoneId.of(tzName) }.getOrElse { ZoneId.of("Asia/Jakarta") }

                val resp = api.getAttendanceSessionToday()
                val ui = resp.data.toDashboardAttendanceUiSafe(zone)

                // pengumuman (visible): ambil 3 terbaru
                val announcements = try {
                    //val tzName = settingsRepository.getTimezoneCached()
                    //val zone = ZoneId.of(tzName)
                    val fmt = DateTimeFormatter.ofPattern("EEEE, dd MMM yyyy", Locale("id", "ID"))

                    val aRes = api.announcements()
                    val list = aRes.data ?: emptyList()
                    list.sortedByDescending { it.created_at }.take(3).map { it.toDashboardUi(zone, fmt) }
                } catch (_: Throwable) {
                    emptyList()
                }

                val dutyList = try {
                    val (fromIso, toIso) = DateRangeUtil.nowToNextTwoMonthsRange(tzName)
                    api.listDutySchedules(
                        from = fromIso,
                        to = toIso,
                        satkerId = profile.satkerId,
                        userId = profile.userId
                    ).data ?: emptyList()
                } catch (_: Throwable) {
                    emptyList()
                }

                val dutyUpcoming = dutyList
                    .map { ds ->
                        val r = dutyRangeUi(ds.start_at, ds.end_at, zone)
                        DashboardDutyUi(
                            id = ds.id,
                            startAt = ds.start_at,
                            endAt = ds.end_at,
                            scheduleType = ds.schedule_type,
                            title = ds.title,
                            note = ds.note,
                            line1 = r.line1,
                            line2 = r.line2
                        )
                    }
                    .sortedBy { java.time.Instant.parse(it.startAt).toEpochMilli() }
                    .take(5)

                _state.update {
                    it.copy(
                        loading = false,
                        error = null,

                        fullName = profile.fullName ?: "-",
                        nrp = profile.nrp ?: "-",

                        workDateText = ui.headerDateText,
                        checkInDateText = ui.checkInDateText,
                        checkInTimeText = ui.checkInTimeText,
                        checkOutDateText = ui.checkOutDateText,
                        checkOutTimeText = ui.checkOutTimeText,
                        checkInEnabled = ui.checkInEnabled,
                        checkOutEnabled = ui.checkOutEnabled,
                        isDuty = ui.isDuty,
                        dutyStartText = ui.dutyStartText,
                        dutyEndText = ui.dutyEndText,
                        announcements = announcements,
                        dutyUpcoming = dutyUpcoming
                    )
                }
            } catch (e: Throwable) {
                _state.update {
                    it.copy(
                        loading = false,
                        error = e.message ?: "Gagal memuat dashboard"
                    )
                }
            } finally {
                loadingNow = false
            }
        }
    }
}

private fun AnnouncementDto.toDashboardUi(
    zone: ZoneId,
    fmt: DateTimeFormatter
): DashboardAnnouncementUi {
    val ms = try { kotlinx.datetime.Instant.parse(created_at).toEpochMilliseconds() } catch (_: Throwable) { 0L }
    val label = try { java.time.Instant.ofEpochMilli(ms).atZone(zone).format(fmt) } catch (_: Throwable) { created_at }
    return DashboardAnnouncementUi(
        id = id,
        title = title,
        dateLabel = label,
        body,
        scope
    )
}
