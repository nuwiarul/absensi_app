package id.resta_pontianak.absensiapp.ui.screens.history

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun AttendanceHistoryRoute(
    onBack: () -> Unit,
    vm: AttendanceHistoryViewModel = hiltViewModel()
) {
    AttendanceHistoryScreen(
        state = vm.state,
        onBack = onBack,
        onPickFrom = vm::setFrom,
        onPickTo = vm::setTo,
        onApply = vm::applyFilter,
        onResetMonth = vm::resetToCurrentMonth,
        onOpenDetail = vm::openDetail,
        onCloseDetail = vm::closeDetail,
        onPreviewPhoto = vm::previewPhoto,
        onClosePhoto = vm::closePhoto,
        onConsumeError = vm::consumeError,
        selfieUrl = vm::selfieUrl,
        imageLoader = vm.imageLoader
    )
}
