package id.resta_pontianak.absensiapp.ui.screens.duty

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TextField
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import dutyRangeUi
import kotlinx.coroutines.launch
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val fmtId = DateTimeFormatter.ofPattern("d MMM yyyy", Locale("id", "ID"))
private fun formatLocalDateId(d: LocalDate): String = d.format(fmtId)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PendingScheduleScreen(
    vm: DutyScheduleViewModel,
    zoneId: ZoneId?,
    snackbarHost: SnackbarHostState
) {
    val scope = rememberCoroutineScope()
    var showPicker by remember { mutableStateOf(false) }

    var showReject by remember { mutableStateOf(false) }
    var rejectTargetId by remember { mutableStateOf<String?>(null) }
    var rejectReason by remember { mutableStateOf("") }

    if (zoneId == null) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator()
        }
        return
    }

    // ✅ Range selector (sama seperti tab Jadwal Dinas)
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Column(Modifier.weight(1f)) {
            Text("Range Tanggal", style = MaterialTheme.typography.labelMedium)
            val txt = if (vm.rangeFrom != null && vm.rangeTo != null) {
                "${formatLocalDateId(vm.rangeFrom!!)} - ${formatLocalDateId(vm.rangeTo!!)}"
            } else "-"
            Text(txt, style = MaterialTheme.typography.bodyMedium)
        }

        OutlinedButton(onClick = { showPicker = true }) { Text("Pilih") }
        Spacer(Modifier.height(0.dp))
        TextButton(onClick = { vm.resetRangeToDefault() }) { Text("Reset") }
    }

    // ✅ Filter status kecil + wrap
    FlowRow(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        val statuses = listOf("SUBMITTED", "APPROVED", "REJECTED", "CANCELED")
        statuses.forEach { st ->
            FilterChip(
                selected = vm.selectedStatus == st,
                onClick = {
                    vm.updateSelectedStatus(st)
                    vm.refreshRequests()
                },
                label = { Text(st, style = MaterialTheme.typography.labelSmall) }
            )
        }
    }

    if (vm.loading) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            horizontalArrangement = Arrangement.Center
        ) {
            CircularProgressIndicator()
        }
    }

    vm.error?.let { msg ->
        Text(
            text = msg,
            color = MaterialTheme.colorScheme.error,
            modifier = Modifier.padding(16.dp)
        )
    }

    LazyColumn {
        items(vm.requests) { r ->
            Column(Modifier.padding(16.dp)) {
                val t = dutyRangeUi(r.start_at, r.end_at, zoneId)

                Text(
                    text = t.line1,
                    style = MaterialTheme.typography.titleMedium
                )
                if (t.line2 != null) {
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = t.line2!!,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Spacer(Modifier.height(4.dp))
                }
                /*Text(
                    text = formatDateId(r.start_at, zoneId),
                    style = MaterialTheme.typography.titleMedium
                )
                Spacer(Modifier.height(4.dp))
                Text(
                    text = "${formatTimeOnly(r.start_at, zoneId)} - ${formatTimeOnly(r.end_at, zoneId)}",
                    style = MaterialTheme.typography.bodyMedium
                )*/

                Text(
                    text = "${r.user_full_name ?: "-"} • ${r.user_nrp ?: "-"}",
                    style = MaterialTheme.typography.bodyMedium
                )
                if (!r.satker_name.isNullOrBlank() || !r.satker_code.isNullOrBlank()) {
                    Text(
                        text = if (r.satker_code.isNullOrBlank()) (r.satker_name ?: "-")
                        else "${r.satker_name ?: "-"} (${r.satker_code})",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                Spacer(Modifier.height(8.dp))

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    DutyTypeChip(type = r.schedule_type)
                    StatusChip(status = r.status)
                }

                if (!r.title.isNullOrBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(text = r.title!!, style = MaterialTheme.typography.bodyMedium)
                }
                if (!r.note.isNullOrBlank()) {
                    Spacer(Modifier.height(2.dp))
                    Text(text = r.note!!, style = MaterialTheme.typography.bodySmall)
                }

                if (r.status.uppercase() == "REJECTED") {
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = r.reject_reason ?: "-",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }

                if (r.status.uppercase() == "SUBMITTED") {
                    Spacer(Modifier.height(10.dp))

                    if (vm.isSatkerHead) {
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Button(onClick = {
                                vm.approveRequest(
                                    id = r.id,
                                    onSuccess = { msg -> scope.launch { snackbarHost.showSnackbar(msg) } },
                                    onError = { msg -> scope.launch { snackbarHost.showSnackbar(msg) } }
                                )
                            }) { Text("Approve") }

                            OutlinedButton(onClick = {
                                rejectTargetId = r.id
                                rejectReason = ""
                                showReject = true
                            }) { Text("Reject") }
                        }
                    } else {
                        OutlinedButton(
                            onClick = {
                                vm.cancelRequest(
                                    id = r.id,
                                    onSuccess = { msg -> scope.launch { snackbarHost.showSnackbar(msg) } },
                                    onError = { msg -> scope.launch { snackbarHost.showSnackbar(msg) } }
                                )
                            }
                        ) { Text("Batalkan") }
                    }

                    /*OutlinedButton(
                        onClick = {
                            vm.cancelRequest(
                                id = r.id,
                                onSuccess = { msg ->
                                    scope.launch { snackbarHost.showSnackbar(msg) }
                                },
                                onError = { msg ->
                                    scope.launch { snackbarHost.showSnackbar(msg) }
                                }
                            )
                        }
                    ) {
                        Text("Batalkan")
                    }*/
                }
            }
            androidx.compose.material3.Divider()
        }
    }

    // ✅ DateRangePicker dialog
    if (showPicker) {
        DateRangePickerDialog(
            initialFrom = vm.rangeFrom,
            initialTo = vm.rangeTo,
            onDismiss = { showPicker = false },
            onApply = { f, t ->
                showPicker = false
                vm.setRange(f, t) // ✅ ini refresh schedules + requests
            }
        )
    }

    if (showReject) {
        AlertDialog(
            onDismissRequest = { showReject = false },
            title = { Text("Reject Pengajuan") },
            text = {
                Column {
                    Text("Alasan reject wajib diisi")
                    Spacer(Modifier.height(8.dp))
                    TextField(
                        value = rejectReason,
                        onValueChange = { rejectReason = it },
                        singleLine = false,
                        minLines = 2,
                        placeholder = { Text("Mis: jadwal tidak sesuai") },
                        modifier = Modifier.fillMaxWidth()
                    )
                }
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val id = rejectTargetId
                        if (id.isNullOrBlank()) {
                            showReject = false
                            return@TextButton
                        }
                        val reason = rejectReason.trim()
                        if (reason.isBlank()) {
                            scope.launch { snackbarHost.showSnackbar("Catatan reject wajib diisi") }
                            return@TextButton
                        }
                        showReject = false
                        vm.rejectRequest(
                            id = id,
                            reason = reason,
                            onSuccess = { msg -> scope.launch { snackbarHost.showSnackbar(msg) } },
                            onError = { msg -> scope.launch { snackbarHost.showSnackbar(msg) } }
                        )
                    }
                ) { Text("Reject") }
            },
            dismissButton = {
                TextButton(onClick = { showReject = false }) { Text("Batal") }
            }
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateRangePickerDialog(
    initialFrom: LocalDate?,
    initialTo: LocalDate?,
    onDismiss: () -> Unit,
    onApply: (LocalDate, LocalDate) -> Unit
) {
    val state = rememberDateRangePickerState()

    AlertDialog(
        onDismissRequest = onDismiss,
        confirmButton = {
            TextButton(
                onClick = {
                    val startMs = state.selectedStartDateMillis
                    val endMs = state.selectedEndDateMillis
                    if (startMs != null && endMs != null) {
                        val start = Instant.fromEpochMilliseconds(startMs)
                            .toLocalDateTime(TimeZone.UTC).date
                        val end = Instant.fromEpochMilliseconds(endMs)
                            .toLocalDateTime(TimeZone.UTC).date

                        val f = LocalDate.of(start.year, start.monthNumber, start.dayOfMonth)
                        val t = LocalDate.of(end.year, end.monthNumber, end.dayOfMonth)
                        onApply(f, t)
                    }
                },
                enabled = state.selectedStartDateMillis != null && state.selectedEndDateMillis != null
            ) { Text("Terapkan") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } },
        title = { Text("Pilih Range Tanggal") },
        text = { DateRangePicker(state = state) }
    )
}
