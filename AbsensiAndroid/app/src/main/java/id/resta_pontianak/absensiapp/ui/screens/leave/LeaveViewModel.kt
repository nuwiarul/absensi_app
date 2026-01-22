package id.resta_pontianak.absensiapp.ui.screens.leave

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.LeaveCreateReq
import id.resta_pontianak.absensiapp.data.network.LeaveListDto
import id.resta_pontianak.absensiapp.data.network.LeavePendingDto
import id.resta_pontianak.absensiapp.data.repo.LeaveRepository
import id.resta_pontianak.absensiapp.ui.helper.LeaveDateRangeUtils
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.distinctUntilChanged
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.datetime.LocalDate
import kotlinx.datetime.plus
import javax.inject.Inject

@HiltViewModel
class LeaveViewModel @Inject constructor(
    private val repo: LeaveRepository,
    private val tokenStore: TokenStore
) : ViewModel() {

    data class State(
        val role: String = "MEMBER",

        // MEMBER: filter status list (SUBMITTED / APPROVED / REJECTED / CANCELLED)
        val statusFilter: String = "SUBMITTED",

        val headAllStatusFilter: String = "ALL",

        val from: LocalDate,
        val to: LocalDate,
        val loading: Boolean = false,
        val error: String? = null,

        // SATKER_HEAD
        val pending: List<LeavePendingDto> = emptyList(),
        val all: List<LeaveListDto> = emptyList(),

        // MEMBER
        val mine: List<LeaveListDto> = emptyList(),

        // Create form
        val createOpen: Boolean = false,
        val leaveType: String = "IJIN",
        val startDate: LocalDate = LeaveDateRangeUtils.defaultRangeJakarta().first, // nanti di-set saat open
        val endDate: LocalDate = LeaveDateRangeUtils.defaultRangeJakarta().first,
        val reason: String = ""
    )

    private var reloadJob: Job? = null

    private val initRange = LeaveDateRangeUtils.defaultRangeJakarta()
    private val _state = MutableStateFlow(
        State(
            from = initRange.first,
            to = initRange.second,
            startDate = initRange.first,
            endDate = initRange.first
        )
    )
    val state: StateFlow<State> = _state

    init {
        viewModelScope.launch {
            tokenStore.sessionKeyFlow
                .map { sk -> Triple(sk.userId.orEmpty(), sk.role.orEmpty(), sk.satkerId.orEmpty()) }
                .distinctUntilChanged()
                .collectLatest { (uid, roleRaw, _) ->

                    val r = LeaveDateRangeUtils.defaultRangeJakarta()

                    if (uid.isBlank()) {
                        // logout → reset full state
                        _state.value = State(
                            role = "MEMBER",
                            statusFilter = "SUBMITTED",        // ✅ default kamu minta APPROVED
                            headAllStatusFilter = "ALL",
                            from = r.first, to = r.second,
                            startDate = r.first, endDate = r.first
                        )
                        // stop request jalan
                        reloadJob?.cancel()
                        return@collectLatest
                    }

                    val role = roleRaw.ifBlank { "MEMBER" }

                    // ✅ user berubah → reset filter default juga
                    _state.update {
                        it.copy(
                            role = role,
                            statusFilter = "SUBMITTED",        // ✅ balik lagi ke APPROVED saat login user baru
                            headAllStatusFilter = "ALL",
                            from = r.first, to = r.second,
                            // optional: reset tab form create
                            createOpen = false,
                            error = null,
                            loading = false
                        )
                    }

                    reload(force = true)
                }
        }
    }

    fun setFrom(d: LocalDate) = _state.update { it.copy(from = d) }
    fun setTo(d: LocalDate) = _state.update { it.copy(to = d) }

    fun setStatusFilter(v: String) {
        _state.update { it.copy(statusFilter = v) }
        reload()
    }

    fun setHeadAllStatusFilter(v: String) {
        _state.update { it.copy(headAllStatusFilter = v) }
        reload()
    }

    fun applyRange() = reload()

    fun reload(force: Boolean = false) {
        val s = _state.value

        if (s.from > s.to) {
            _state.update { it.copy(error = "Range tanggal tidak valid") }
            return
        }

        // ✅ cancel request sebelumnya (biar tidak numpuk)
        reloadJob?.cancel()
        reloadJob = viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }

            try {
                val result = withContext(Dispatchers.IO) {
                    if (s.role == "SATKER_HEAD") {
                        val pending = repo.pending()

                        val st = s.headAllStatusFilter
                            .takeIf { it.isNotBlank() && it != "ALL" }

                        val all = repo.all(s.from.toString(), s.to.toString(), st)
                        Triple(pending, all, emptyList<LeaveListDto>())
                    } else {
                        val status = s.statusFilter.takeIf { it.isNotBlank() }
                        val mine = repo.mine(s.from.toString(), s.to.toString(), status)
                        Triple(emptyList(), emptyList(), mine)
                    }
                }

                _state.update {
                    it.copy(
                        loading = false,
                        pending = result.first,
                        all = result.second,
                        mine = result.third
                    )
                }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Gagal memuat ijin") }
            }
        }
    }


    fun consumeError() = _state.update { it.copy(error = null) }

    // ----- Create flow (MEMBER) -----
    fun openCreate() {
        val tzRange = LeaveDateRangeUtils.defaultRangeJakarta()
        val today =
            tzRange.first.plus(kotlinx.datetime.DatePeriod(days = 7)) // balik ke "today" (range -7)
        _state.update {
            it.copy(
                createOpen = true,
                leaveType = "IJIN",
                startDate = today,
                endDate = today,
                reason = ""
            )
        }
    }

    fun closeCreate() = _state.update { it.copy(createOpen = false) }
    fun setLeaveType(v: String) = _state.update { it.copy(leaveType = v) }
    fun setStartDate(d: LocalDate) = _state.update { it.copy(startDate = d) }
    fun setEndDate(d: LocalDate) = _state.update { it.copy(endDate = d) }
    fun setReason(v: String) = _state.update { it.copy(reason = v) }

    fun submitCreate() {
        val s = _state.value
        if (s.reason.isBlank()) {
            _state.update { it.copy(error = "Alasan wajib diisi") }
            return
        }
        if (s.startDate > s.endDate) {
            _state.update { it.copy(error = "Tanggal mulai > tanggal akhir") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                repo.createLeave(
                    LeaveCreateReq(
                        leaveType = s.leaveType,
                        startDate = s.startDate.toString(),
                        endDate = s.endDate.toString(),
                        reason = s.reason.trim()
                    )
                )
                _state.update { it.copy(loading = false, createOpen = false) }
                reload()
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        loading = false,
                        error = e.message ?: "Gagal membuat ijin"
                    )
                }
            }
        }
    }

    // ----- Approve / Reject (SATKER_HEAD) -----
    fun approve(id: String, note: String) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                repo.approve(id, note)
                _state.update { it.copy(loading = false) }
                reload()
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Approve gagal") }
            }
        }
    }

    fun reject(id: String, note: String) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                repo.reject(id, note)
                _state.update { it.copy(loading = false) }
                reload()
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Reject gagal") }
            }
        }
    }

    // ----- Cancel (MEMBER) -----
    fun cancel(id: String) {
        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                repo.cancel(id)
                _state.update { it.copy(loading = false) }
                reload()
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = e.message ?: "Batal ijin gagal") }
            }
        }
    }
}
