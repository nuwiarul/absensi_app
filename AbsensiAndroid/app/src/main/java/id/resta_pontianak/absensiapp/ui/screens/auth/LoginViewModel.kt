package id.resta_pontianak.absensiapp.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.repo.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val username: String = "",
    val password: String = "",
    val loading: Boolean = false,
    val errorMessage: String? = null
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val repo: AuthRepository
): ViewModel() {
    private val _state = MutableStateFlow(LoginUiState())
    val state: StateFlow<LoginUiState> = _state


    fun onUsernameChange(v: String) {
        _state.value = _state.value.copy(username = v, errorMessage = null)
    }

    fun onPasswordChange(v: String) {
        _state.value = _state.value.copy(password = v, errorMessage = null)
    }

    fun login(onSuccess: () -> Unit) {
        val s = _state.value

        if (s.username.isBlank() || s.password.isBlank()) {
            _state.value = s.copy(errorMessage = "Username dan password wajib diisi")
            return
        }

        _state.value = s.copy(loading = true, errorMessage = null)

        viewModelScope.launch {
            val result = repo.login(s.username.trim(), s.password)

            result.onSuccess {
                _state.value = _state.value.copy(loading = false)
                onSuccess()
            }.onFailure { e ->
                _state.value = _state.value.copy(
                    loading = false,
                    errorMessage = e.message ?: "Login gagal"
                )
            }
        }

    }

}
