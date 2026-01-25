package id.resta_pontianak.absensiapp.ui.screens.apelhistory

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun ApelHistoryRoute(
    onBack: () -> Unit,
    vm: ApelHistoryViewModel = hiltViewModel()
) {
    val s by vm.state.collectAsState()
    ApelHistoryScreen(
        from = s.from,
        to = s.to,
        loading = s.loading,
        error = s.error,
        items = s.items,
        onBack = onBack,
        onRetry = { vm.reload() },
        onApplyRange = { from, to -> vm.setRange(from, to) },
    )
}
