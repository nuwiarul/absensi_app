package id.resta_pontianak.absensiapp.ui.screens.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DashboardUiState(
    val loading: Boolean = false,
    val error: String? = null,

    val fullName: String = "-",
    val nrp: String = "-",

    val workDateText: String? = null,
    val checkInTime: String = "--:--",
    val checkOutTime: String = "--:--",
    val checkInSubtitle: String = "Lokasi",
    val checkOutSubtitle: String = "Lokasi",
)

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore
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

                val resp = api.getAttendanceToday()
                val ui = mapToDashboardAttendanceUi(resp.data)

                _state.update {
                    it.copy(
                        loading = false,
                        error = null,

                        fullName = profile.fullName ?: "-",
                        nrp = profile.nrp ?: "-",

                        workDateText = ui.headerDateText,
                        checkInTime = ui.checkInTime,
                        checkOutTime = ui.checkOutTime,
                        checkInSubtitle = ui.checkInSubtitle,
                        checkOutSubtitle = ui.checkOutSubtitle,
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
