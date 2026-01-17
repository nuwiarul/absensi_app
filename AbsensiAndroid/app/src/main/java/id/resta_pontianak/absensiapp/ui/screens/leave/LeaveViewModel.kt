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
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
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

    private val initRange = LeaveDateRangeUtils.defaultRangeJakarta()
    private val _state = MutableStateFlow(
        State(from = initRange.first, to = initRange.second, startDate = initRange.first, endDate = initRange.first)
    )
    val state: StateFlow<State> = _state

    init {
        viewModelScope.launch {
            val p = tokenStore.getProfile()
            val role = p?.role ?: "MEMBER"
            _state.update { it.copy(role = role) }
            reload()
        }
    }

    fun setFrom(d: LocalDate) = _state.update { it.copy(from = d) }
    fun setTo(d: LocalDate) = _state.update { it.copy(to = d) }

    fun applyRange() = reload()

    fun reload() {
        val s = _state.value
        if (s.from > s.to) {
            _state.update { it.copy(error = "Range tanggal tidak valid") }
            return
        }

        viewModelScope.launch {
            _state.update { it.copy(loading = true, error = null) }
            try {
                if (s.role == "SATKER_HEAD") {
                    val pending = repo.pending()
                    val all = repo.all(s.from.toString(), s.to.toString())
                    _state.update { it.copy(loading = false, pending = pending, all = all) }
                } else {
                    val mine = repo.mine(s.from.toString(), s.to.toString())
                    _state.update { it.copy(loading = false, mine = mine) }
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
        val today = tzRange.first.plus(kotlinx.datetime.DatePeriod(days = 7)) // balik ke "today" (range -7)
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
                _state.update { it.copy(loading = false, error = e.message ?: "Gagal membuat ijin") }
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
}
