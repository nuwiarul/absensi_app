package id.resta_pontianak.absensiapp.ui.badges

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiErrorParser
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.repo.LeaveEvents
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.LocalDate
import java.time.ZoneId
import javax.inject.Inject

/**
 * Badge untuk Leave SUBMITTED (±7 hari) yang dipakai di:
 * - Bottom nav item "Ijin"
 * - Account menu "Riwayat Perizinan"
 */
@HiltViewModel
class LeaveBadgeViewModel @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
    private val settingsRepository: SettingsRepository,
) : ViewModel() {

    data class State(
        val submittedCount: Int = 0,
        val loading: Boolean = false,
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    // simple TTL cache biar tidak spam API
    private var lastFetchAtMs: Long = 0L
    private val ttlMs: Long = 60_000L

    private var refreshJob: Job? = null


    init {
        viewModelScope.launch {
            tokenStore.sessionKeyFlow
                .map { it.userId to (it.role ?: "MEMBER") }
                .distinctUntilChanged()
                .collectLatest { (uid, _) ->
                    if (uid.isNullOrBlank()) {
                        lastFetchAtMs = 0L
                        refreshJob?.cancel()
                        _state.update { it.copy(submittedCount = 0, loading = false) }
                        return@collectLatest
                    }

                    lastFetchAtMs = 0L
                    _state.update { it.copy(submittedCount = 0) }
                    refresh(force = true)
            }
        }

        viewModelScope.launch {
            LeaveEvents.changes.collectLatest {
                refresh(force = true)
            }
        }
    }

    fun refresh(force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && (now - lastFetchAtMs) <= ttlMs) return
        lastFetchAtMs = now

        refreshJob?.cancel()
        refreshJob = viewModelScope.launch {
            _state.update { it.copy(loading = true) }

            val resultCount = withContext(Dispatchers.IO) {
                try {
                    val profile = tokenStore.getProfile()
                    val role = (profile?.role ?: "MEMBER").uppercase()

                    val tz = settingsRepository.getTimezoneCached()
                    val zone = runCatching { ZoneId.of(tz) }.getOrElse { ZoneId.of("Asia/Jakarta") }
                    val today = LocalDate.now(zone)

                    val from = today.minusDays(7).toString()
                    val to = today.plusDays(7).toString()

                    when (role) {
                        "SATKER_HEAD" -> {
                            val res = api.leaveAll(from = from, to = to, status = "SUBMITTED")
                            if (res.status != "200") 0 else (res.data?.size ?: 0)
                        }
                        else -> {
                            val res = api.leaveMine(from = from, to = to, status = "SUBMITTED")
                            if (res.status != "200") 0 else (res.data?.size ?: 0)
                        }
                    }
                } catch (_: Exception) {
                    0
                }
            }

            _state.update { it.copy(submittedCount = resultCount, loading = false) }
        }
    }
}
