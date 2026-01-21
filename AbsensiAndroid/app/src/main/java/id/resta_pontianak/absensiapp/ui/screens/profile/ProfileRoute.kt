package id.resta_pontianak.absensiapp.ui.screens.profile

import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun ProfileRoute(
    onBack: () -> Unit,
    vm: ProfileViewModel = hiltViewModel()
) {
    val s by vm.state.collectAsState()
    val snackbarHost = SnackbarHostState()

    // ✅ success snackbar
    LaunchedEffect(s.successMessage) {
        s.successMessage?.let {
            snackbarHost.showSnackbar(it)
            vm.consumeSuccess()
        }
    }

    // ✅ fetch error snackbar (bukan edit error)
    LaunchedEffect(s.errorMessage) {
        s.errorMessage?.let {
            snackbarHost.showSnackbar(it)
            vm.consumeError()
        }
    }

    ProfileScreen(
        state = s,
        onBack = onBack,
        snackbarHost = { SnackbarHost(snackbarHost) },

        onOpenEdit = vm::openEditDialog,
        onCloseEdit = vm::closeEditDialog,
        onEditFullName = vm::onEditFullName,
        onEditPhone = vm::onEditPhone,
        onSaveEdit = vm::saveEdit
    )
}
