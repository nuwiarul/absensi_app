package id.resta_pontianak.absensiapp.ui.screens.leave

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel

@Composable
fun LeaveRoute(onBack: () -> Unit) {
    val vm: LeaveViewModel = hiltViewModel()
    val s by vm.state.collectAsState()

    LeaveScreen(
        state = s,
        onBack = onBack,
        onPickFrom = vm::setFrom,
        onPickTo = vm::setTo,
        onApplyRange = vm::applyRange,
        onReload = vm::reload,
        onConsumeError = vm::consumeError,

        onOpenCreate = vm::openCreate,
        onCloseCreate = vm::closeCreate,
        onSetLeaveType = vm::setLeaveType,
        onSetStartDate = vm::setStartDate,
        onSetEndDate = vm::setEndDate,
        onSetReason = vm::setReason,
        onSubmitCreate = vm::submitCreate,

        // MEMBER: filter & cancel
        onSetStatusFilter = vm::setStatusFilter,
        onSetHeadAllStatusFilter = vm::setHeadAllStatusFilter,
        onCancel = vm::cancel,

        onApprove = vm::approve,
        onReject = vm::reject
    )
}
