package id.resta_pontianak.absensiapp.ui.screens.auth

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.hilt.navigation.compose.hiltViewModel
import id.resta_pontianak.absensiapp.data.repo.AuthRepository

@Composable
fun LoginRoute(
    onLoginSuccess: () -> Unit
) {
    val vm: LoginViewModel = hiltViewModel()
    val state by vm.state.collectAsState()

    LoginScreen(
        state = state,
        onUsernameChange = vm::onUsernameChange,
        onPasswordChange = vm::onPasswordChange,
        onLoginClick = {
            vm.login(onSuccess = onLoginSuccess)
        }
    )
}