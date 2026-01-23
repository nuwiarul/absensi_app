package id.resta_pontianak.absensiapp.ui.screens.announcement

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun AnnouncementsRoute(
    onBack: () -> Unit,
    vm: AnnouncementsViewModel = hiltViewModel()
) {
    AnnouncementsScreen(
        state = vm.state,
        onBack = onBack,
        onRefresh = vm::refresh,
        onConsumeError = vm::consumeError
    )
}
