package id.resta_pontianak.absensiapp.ui.screens.leave

import android.app.DatePickerDialog
import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.data.network.LeaveListDto
import id.resta_pontianak.absensiapp.data.network.LeavePendingDto
import kotlinx.datetime.LocalDate
import java.util.Calendar
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MenuAnchorType // Penting untuk versi terbaru
import androidx.compose.foundation.layout.Row
import android.widget.Toast
import androidx.compose.runtime.saveable.rememberSaveable

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LeaveScreen(
    state: LeaveViewModel.State,
    onBack: () -> Unit,

    onPickFrom: (LocalDate) -> Unit,
    onPickTo: (LocalDate) -> Unit,
    onApplyRange: () -> Unit,
    onReload: () -> Unit,
    onConsumeError: () -> Unit,

    // create
    onOpenCreate: () -> Unit,
    onCloseCreate: () -> Unit,
    onSetLeaveType: (String) -> Unit,
    onSetStartDate: (LocalDate) -> Unit,
    onSetEndDate: (LocalDate) -> Unit,
    onSetReason: (String) -> Unit,
    onSubmitCreate: () -> Unit,

    // MEMBER
    onSetStatusFilter: (String) -> Unit,
    onCancel: (String) -> Unit,
    onSetHeadAllStatusFilter: (String) -> Unit,
    // head
    onApprove: (String, String) -> Unit,
    onReject: (String, String) -> Unit
) {
    val ctx = LocalContext.current
    val snackbar = remember { SnackbarHostState() }

    LaunchedEffect(state.error) {
        state.error?.let {
            snackbar.showSnackbar(it)
            onConsumeError()
        }
    }

    Scaffold(
        snackbarHost = { SnackbarHost(snackbar) },
        topBar = {
            TopAppBar(
                title = { Text("Ijin / Leave") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
                },
                actions = {
                    if (state.role != "SATKER_HEAD") {
                        Button(
                            onClick = onOpenCreate,
                            enabled = !state.loading
                        ) { Text("Buat Ijin") }
                    } else {
                        TextButton(onClick = onReload, enabled = !state.loading) { Text("Refresh") }
                    }
                },
                windowInsets = WindowInsets(0, 0, 0, 0) // opsional: bikin lebih rapat ke atas
            )
        }
    ) { padding ->

        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            // Range filter (untuk list “Semua” / “Mine”)
            RangeBar(
                ctx = ctx,
                from = state.from,
                to = state.to,
                loading = state.loading,
                onPickFrom = { showDatePicker(ctx, state.from, onPickFrom) },
                onPickTo = { showDatePicker(ctx, state.to, onPickTo) },
                onApply = onApplyRange
            )

            if (state.role == "SATKER_HEAD") {
                /*
                var tab by remember { mutableIntStateOf(0) }
                PrimaryTabRow(selectedTabIndex = tab) {
                    Tab(
                        selected = tab == 0,
                        onClick = { tab = 0 },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Pending")
                                Spacer(Modifier.width(8.dp))
                                if (state.pending.isNotEmpty()) {
                                    Badge { Text(state.pending.size.toString()) }
                                }
                            }
                        }
                    )
                    Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Semua") })
                }

                when (tab) {
                    0 -> PendingList(
                        loading = state.loading,
                        items = state.pending,
                        onApprove = onApprove,
                        onReject = onReject
                    )
                    1 -> LeaveList(
                        loading = state.loading,
                        items = state.all,
                        isHead = true
                    )
                }

                 */

                // 0 = Pending, 1 = Semua
                var tab by rememberSaveable { mutableIntStateOf(0) }
                var userPickedTab by rememberSaveable { mutableStateOf(false) }

// ✅ Initial auto-tab: kalau pending ada, ke Pending. kalau tidak, ke Semua.
                LaunchedEffect(state.role) {
                    if (state.role == "SATKER_HEAD" && !userPickedTab) {
                        tab = if (state.pending.isNotEmpty()) 0 else 1
                    }
                }

// ✅ Auto-tab saat data pending berubah (misal setelah approve/reject/reload)
// - kalau user belum pernah pilih tab manual: selalu ikuti pending count
// - kalau user sudah pilih tab manual: hanya auto pindah ke Semua ketika tab=Pending dan pending jadi kosong
                LaunchedEffect(state.pending.size) {
                    if (state.role != "SATKER_HEAD") return@LaunchedEffect

                    if (!userPickedTab) {
                        tab = if (state.pending.isNotEmpty()) 0 else 1
                    } else {
                        // user sedang di Pending dan pending habis → pindah ke Semua
                        if (tab == 0 && state.pending.isEmpty()) {
                            tab = 1
                        }
                    }
                }

                PrimaryTabRow(selectedTabIndex = tab) {
                    Tab(
                        selected = tab == 0,
                        onClick = {
                            userPickedTab = true
                            tab = 0
                        },
                        text = {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("Pending")
                                if (state.pending.isNotEmpty()) {
                                    Spacer(Modifier.width(8.dp))
                                    Badge { Text(state.pending.size.toString()) }
                                }
                            }
                        }
                    )
                    Tab(
                        selected = tab == 1,
                        onClick = {
                            userPickedTab = true
                            tab = 1
                        },
                        text = { Text("Semua") }
                    )
                }

                when (tab) {
                    0 -> PendingList(
                        loading = state.loading,
                        items = state.pending,
                        onApprove = onApprove,
                        onReject = onReject
                    )

                    1 -> {
                        StatusFilterBarHeadAll(
                            selected = state.headAllStatusFilter,
                            enabled = !state.loading,
                            onSelect = onSetHeadAllStatusFilter
                        )
                        LeaveList(
                            loading = state.loading,
                            items = state.all,
                            isHead = true
                        )
                    }
                }

            } else {
                // MEMBER: hanya list mine
                StatusFilterBar(
                    selected = state.statusFilter,
                    enabled = !state.loading,
                    onSelect = onSetStatusFilter
                )
                LeaveList(
                    loading = state.loading,
                    items = state.mine,
                    isHead = false,
                    role = state.role,
                    onCancel = onCancel
                )
            }
        }

        if (state.createOpen) {
            CreateLeaveDialog(
                ctx = ctx,
                loading = state.loading,
                leaveType = state.leaveType,
                startDate = state.startDate,
                endDate = state.endDate,
                reason = state.reason,
                onSetLeaveType = onSetLeaveType,
                onPickStart = { showDatePicker(ctx, state.startDate, onSetStartDate) },
                onPickEnd = { showDatePicker(ctx, state.endDate, onSetEndDate) },
                onReason = onSetReason,
                onClose = onCloseCreate,
                onSubmit = onSubmitCreate
            )
        }
    }
}

@Composable
private fun RangeBar(
    ctx: Context,
    from: LocalDate,
    to: LocalDate,
    loading: Boolean,
    onPickFrom: () -> Unit,
    onPickTo: () -> Unit,
    onApply: () -> Unit
) {
    Card(modifier = Modifier.padding(12.dp)) {
        Column(modifier = Modifier.padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onPickFrom,
                    enabled = !loading
                ) { Text("Dari: $from") }

                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onPickTo,
                    enabled = !loading
                ) { Text("Sampai: $to") }
            }

            Spacer(modifier = Modifier.height(10.dp))

            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = onApply,
                enabled = !loading
            ) {
                if (loading) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(18.dp),
                        strokeWidth = 2.dp
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                }
                Text("Terapkan")
            }
        }
    }
}

@Composable
private fun PendingList(
    loading: Boolean,
    items: List<LeavePendingDto>,
    onApprove: (String, String) -> Unit,
    onReject: (String, String) -> Unit
) {
    if (loading && items.isEmpty()) {
        Box(
            Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) { CircularProgressIndicator() }
        return
    }
    if (items.isEmpty()) {
        Box(
            Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) { Text("Tidak ada pending.") }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(items, key = { it.id }) { itx ->
            PendingCard(item = itx, onApprove = onApprove, onReject = onReject)
        }
    }
}

@Composable
private fun PendingCard(
    item: LeavePendingDto,
    onApprove: (String, String) -> Unit,
    onReject: (String, String) -> Unit
) {
    var note by remember { mutableStateOf("") }

    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Text(
                "${item.requesterName} • ${item.requesterNrp}",
                style = MaterialTheme.typography.titleSmall
            )
            Text(
                "${item.satkerName} (${item.satkerCode})",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(8.dp))
            Text("Tipe: ${item.tipe}")
            Text("Tanggal: ${item.startDate} s/d ${item.endDate}")
            Text("Alasan: ${item.reason}")

            Spacer(Modifier.height(10.dp))
            OutlinedTextField(
                value = note,
                onValueChange = { note = it },
                label = { Text("Catatan (opsional)") },
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(Modifier.height(10.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(
                    modifier = Modifier.weight(1f),
                    onClick = { onApprove(item.id, note.ifBlank { "Disetujui" }) }
                ) { Text("Approve") }

                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = { onReject(item.id, note.ifBlank { "Ditolak" }) }
                ) { Text("Reject") }
            }
        }
    }
}

@Composable
private fun LeaveList(
    loading: Boolean,
    items: List<LeaveListDto>,
    isHead: Boolean,
    role: String = "MEMBER",
    onCancel: (String) -> Unit = {}
) {
    if (loading && items.isEmpty()) {
        Box(
            Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) { CircularProgressIndicator() }
        return
    }
    if (items.isEmpty()) {
        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text("Tidak ada data.") }
        return
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp)
    ) {
        items(items, key = { it.id }) { itx ->
            LeaveCard(
                item = itx, showUser = isHead, role = role,
                onCancel = onCancel
            )
        }
    }
}

@Composable
private fun LeaveCard(
    item: LeaveListDto,
    showUser: Boolean,
    role: String,
    onCancel: (String) -> Unit
) {
    val status = item.status
    var confirmCancel by remember { mutableStateOf(false) }

    if (confirmCancel) {
        AlertDialog(
            onDismissRequest = { confirmCancel = false },
            title = { Text("Batalkan ijin?") },
            text = { Text("Ijin yang dibatalkan akan berstatus CANCELLED dan tidak bisa diproses lagi.") },
            confirmButton = {
                Button(onClick = {
                    confirmCancel = false
                    onCancel(item.id)
                }) { Text("Ya, batalkan") }
            },
            dismissButton = {
                TextButton(onClick = { confirmCancel = false }) { Text("Tidak") }
            }
        )
    }
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(item.tipe, style = MaterialTheme.typography.titleSmall)
                //AssistChip(onClick = {}, label = { Text(status) })
                StatusChip(item.status)
            }

            Text("Tanggal: ${item.startDate} s/d ${item.endDate}")
            Text("Alasan: ${item.reason}")

            // MEMBER can cancel only when SUBMITTED
            val canCancel =
                (!showUser) && role == "MEMBER" && status.equals("SUBMITTED", ignoreCase = true)
            if (canCancel) {
                Spacer(Modifier.height(10.dp))
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    OutlinedButton(onClick = { confirmCancel = true }) {
                        Text("Batal")
                    }
                }
            }

            if (showUser) {
                Spacer(Modifier.height(6.dp))
                Text(
                    "${item.userFullName} • ${item.userNrp}",
                    style = MaterialTheme.typography.bodySmall
                )
                Text(
                    "${item.satkerName} (${item.satkerCode})",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }

            if (!item.decisionNote.isNullOrBlank()) {
                Spacer(Modifier.height(6.dp))
                Text("Catatan: ${item.decisionNote}", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun StatusFilterBar(
    selected: String,
    enabled: Boolean,
    onSelect: (String) -> Unit
) {
    val options = listOf("SUBMITTED", "APPROVED", "REJECTED", "CANCELLED")

    // horizontal row, wrap if needed
    @OptIn(ExperimentalLayoutApi::class)
    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
        maxItemsInEachRow = 4
    ) {
        options.forEach { opt ->
            val isSelected = opt.equals(selected, ignoreCase = true)
            AssistChip(
                modifier = Modifier.height(32.dp),
                onClick = { if (enabled) onSelect(opt) },
                label = {
                    // UI label follow user wording: CANCELED, but backend uses CANCELLED
                    val label = if (opt == "CANCELLED") "CANCELED" else opt
                    Text(label, style = MaterialTheme.typography.labelSmall)
                },
                enabled = enabled,
                colors = if (isSelected)
                    AssistChipDefaults.assistChipColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        labelColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                else
                    AssistChipDefaults.assistChipColors()
            )
        }
    }
}

@Composable
private fun StatusFilterBarHeadAll(
    selected: String,
    enabled: Boolean,
    onSelect: (String) -> Unit
) {
    val options = listOf("ALL", "APPROVED", "REJECTED", "CANCELLED")

    @OptIn(ExperimentalLayoutApi::class)
    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        options.forEach { opt ->
            val isSelected = opt.equals(selected, ignoreCase = true)
            AssistChip(
                modifier = Modifier.height(32.dp),
                onClick = { if (enabled) onSelect(opt) },
                label = { Text(opt, style = MaterialTheme.typography.labelSmall) },
                enabled = enabled,
                colors = if (isSelected)
                    AssistChipDefaults.assistChipColors(
                        containerColor = MaterialTheme.colorScheme.primaryContainer,
                        labelColor = MaterialTheme.colorScheme.onPrimaryContainer
                    )
                else AssistChipDefaults.assistChipColors()
            )
        }
    }
}


private fun showDatePicker(context: Context, initial: LocalDate, onPicked: (LocalDate) -> Unit) {
    val cal = Calendar.getInstance().apply {
        set(Calendar.YEAR, initial.year)
        set(Calendar.MONTH, initial.monthNumber - 1)
        set(Calendar.DAY_OF_MONTH, initial.dayOfMonth)
    }
    DatePickerDialog(
        context,
        { _, y, m, d -> onPicked(LocalDate(y, m + 1, d)) },
        cal.get(Calendar.YEAR),
        cal.get(Calendar.MONTH),
        cal.get(Calendar.DAY_OF_MONTH)
    ).show()
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateLeaveDialog(
    ctx: Context,
    loading: Boolean,
    leaveType: String,
    startDate: LocalDate,
    endDate: LocalDate,
    reason: String,
    onSetLeaveType: (String) -> Unit,
    onPickStart: () -> Unit,
    onPickEnd: () -> Unit,
    onReason: (String) -> Unit,
    onClose: () -> Unit,
    onSubmit: () -> Unit
) {
    val types = listOf("IJIN", "SAKIT", "CUTI", "DINAS_LUAR")

    AlertDialog(
        onDismissRequest = { if (!loading) onClose() },
        confirmButton = {
            Button(onClick = onSubmit, enabled = !loading) {
                if (loading) CircularProgressIndicator(
                    modifier = Modifier.size(18.dp),
                    strokeWidth = 2.dp
                )
                Spacer(Modifier.width(8.dp))
                Text("Submit")
            }
        },
        dismissButton = {
            TextButton(onClick = onClose, enabled = !loading) { Text("Batal") }
        },
        title = { Text("Buat Ijin") },
        text = {
            Column {
                // dropdown type
                var expanded by remember { mutableStateOf(false) }
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = !expanded }) {
                    OutlinedTextField(
                        value = leaveType,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Tipe") },
                        modifier = Modifier
                            .menuAnchor()
                            .fillMaxWidth()
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }) {
                        types.forEach { t ->
                            DropdownMenuItem(
                                text = { Text(t) },
                                onClick = {
                                    onSetLeaveType(t)
                                    expanded = false
                                }
                            )
                        }
                    }
                }

                Spacer(Modifier.height(10.dp))
                OutlinedButton(
                    onClick = onPickStart,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Mulai: $startDate") }
                Spacer(Modifier.height(8.dp))
                OutlinedButton(
                    onClick = onPickEnd,
                    modifier = Modifier.fillMaxWidth()
                ) { Text("Sampai: $endDate") }

                Spacer(Modifier.height(10.dp))
                OutlinedTextField(
                    value = reason,
                    onValueChange = onReason,
                    label = { Text("Alasan") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2
                )
            }
        }
    )
}

@Composable
private fun StatusChip(status: String) {
    val s = status.uppercase()
    val colors = when (s) {
        "APPROVED" -> AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            labelColor = MaterialTheme.colorScheme.onPrimaryContainer
        )

        "REJECTED" -> AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.errorContainer,
            labelColor = MaterialTheme.colorScheme.onErrorContainer
        )

        else -> AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            labelColor = MaterialTheme.colorScheme.onSecondaryContainer
        )
    }

    AssistChip(
        onClick = {},
        label = { Text(s) },
        colors = colors
    )
}
