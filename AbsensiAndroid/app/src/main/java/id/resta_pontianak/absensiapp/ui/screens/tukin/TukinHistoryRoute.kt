package id.resta_pontianak.absensiapp.ui.screens.tukin

import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun TukinHistoryRoute(
    onBack: () -> Unit,
    initialMonth: String
) {
    val vm: TukinHistoryViewModel = hiltViewModel()

    LaunchedEffect(initialMonth) {
        vm.init(initialMonth)
    }

    TukinHistoryScreen(
        stateFlow = vm.state,
        onBack = onBack,
        onPickMonth = vm::setMonth,
        onGenerate = vm::generate,
        onConsumeSnack = vm::consumeSnack
    )
}
