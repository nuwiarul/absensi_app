package id.resta_pontianak.absensiapp.ui.screens.apelhistory

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.network.AttendanceApelDto
import id.resta_pontianak.absensiapp.data.repo.ApelRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject
import kotlinx.datetime.LocalDate
import id.resta_pontianak.absensiapp.ui.helper.DateRangeUtils

@HiltViewModel
class ApelHistoryViewModel @Inject constructor(
    private val apelRepo: ApelRepository
) : ViewModel() {

    data class State(
        val from: LocalDate,
        val to: LocalDate,
        val loading: Boolean = false,
        val error: String? = null,
        val items: List<AttendanceApelDto> = emptyList(),
    )

    private val initialRange = DateRangeUtils.currentMonthRangeJakarta()

    private val _state = MutableStateFlow(
        State(
            from = initialRange.first,
            to = initialRange.second,
        )
    )

    val state: StateFlow<State> = _state

    init {
        reload()
    }

    fun setRange(from: LocalDate, to: LocalDate) {
        _state.value = _state.value.copy(from = from, to = to)
        reload()
    }

    fun reload() {
        val s = _state.value
        val fromIso = s.from.toString()
        val toIso = s.to.toString()

        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val list = apelRepo.listApelHistory(fromIso, toIso)
                _state.value = _state.value.copy(
                    loading = false,
                    items = list
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    error = e.message ?: "Terjadi kesalahan"
                )
            }
        }
    }
}
