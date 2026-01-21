package id.resta_pontianak.absensiapp.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiErrorParser
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.UpdateMyProfileReq
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val api: ApiService,
    private val tokenStore: TokenStore,
) : ViewModel() {

    data class State(
        val isLoading: Boolean = true,
        val isSaving: Boolean = false,

        val id: String = "-",
        val fullName: String = "-",
        val nrp: String = "-",
        val email: String = "-",
        val role: String = "-",
        val isActive: Boolean = false,
        val satkerName: String = "-",
        val rank: String = "-",
        val phone: String = "-",

        // ✅ Dialog edit
        val showEditDialog: Boolean = false,
        val editFullName: String = "",
        val editPhone: String = "",
        val editError: String? = null, // ✅ error ditampilkan di dialog

        // ✅ Snackbar
        val successMessage: String? = null,
        val errorMessage: String? = null
    )

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    init {
        refresh()
    }

    fun consumeSuccess() {
        _state.value = _state.value.copy(successMessage = null)
    }

    fun consumeError() {
        _state.value = _state.value.copy(errorMessage = null)
    }

    fun refresh() {
        viewModelScope.launch {
            _state.value = _state.value.copy(isLoading = true, errorMessage = null)
            try {
                val res = api.getMe()
                val u = res.data

                _state.value = _state.value.copy(
                    isLoading = false,

                    id = u?.id ?: "-",
                    fullName = u?.full_name ?: "-",
                    nrp = u?.nrp ?: "-",
                    email = u?.email ?: "-",
                    role = u?.role ?: "MEMBER",
                    isActive = u?.is_active ?: true,
                    satkerName = u?.satker?.name ?: "-",
                    rank = u?.rank ?: "-",
                    phone = u?.phone ?: "-",

                    // ✅ set default untuk dialog edit
                    editFullName = u?.full_name ?: "-",
                    editPhone = u?.phone ?: "-"
                )
            } catch (e: Throwable) {
                _state.value = _state.value.copy(
                    isLoading = false,
                    errorMessage = ApiErrorParser.parse(e)
                )
            }
        }
    }

    // ✅ Dialog controls
    fun openEditDialog() {
        val s = _state.value
        _state.value = s.copy(
            showEditDialog = true,
            editFullName = if (s.fullName == "-") "" else s.fullName,
            editPhone = if (s.phone == "-") "" else s.phone,
            editError = null
        )
    }

    fun closeEditDialog() {
        val s = _state.value
        if (s.isSaving) return
        _state.value = s.copy(showEditDialog = false, editError = null)
    }

    fun onEditFullName(v: String) {
        _state.value = _state.value.copy(editFullName = v, editError = null)
    }

    fun onEditPhone(v: String) {
        _state.value = _state.value.copy(editPhone = v, editError = null)
    }

    fun saveEdit() {
        viewModelScope.launch {
            val s = _state.value
            val fullName = s.editFullName.trim()
            val phone = s.editPhone.trim().ifBlank { null }

            // ✅ validasi wajib
            if (fullName.isBlank()) {
                _state.value = s.copy(editError = "full_name di butuhkan")
                return@launch
            }

            _state.value = s.copy(isSaving = true, editError = null)

            try {
                val res = api.updateMyProfile(
                    UpdateMyProfileReq(
                        full_name = fullName,
                        phone = phone
                    )
                )

                if (res.status == "200") {
                    // ✅ update UI langsung
                    _state.value = _state.value.copy(
                        isSaving = false,
                        showEditDialog = false,
                        fullName = fullName,
                        phone = phone ?: "-",
                        successMessage = "Sukses update profile"
                    )

                    // ✅ update local (biar AccountScreen ikut berubah)
                    tokenStore.setFullName(fullName)
                    // (opsional) kalau kamu simpan phone juga:
                    // tokenStore.setPhone(phone)

                } else {
                    // fallback jika server balikin format tak terduga
                    _state.value = _state.value.copy(
                        isSaving = false,
                        editError = "gagal"
                    )
                }
            } catch (e: Throwable) {
                _state.value = _state.value.copy(
                    isSaving = false,
                    editError = ApiErrorParser.parse(e) // ✅ error di dialog
                )
            }
        }
    }
}
