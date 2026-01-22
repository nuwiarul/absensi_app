package id.resta_pontianak.absensiapp.ui.screens.duty

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Divider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.rememberDateRangePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import dutyRangeUi
import fmtId
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale



private fun formatLocalDateId(d: LocalDate): String = d.format(fmtId)

@Composable
fun DutyScheduleScreen(
    vm: DutyScheduleViewModel,
    zoneId: ZoneId?
) {
    var showPicker by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        vm.initDefaultRangeIfNeeded()
        vm.refreshSchedules()
    }

    if (zoneId == null) {
        Column(
            modifier = Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            CircularProgressIndicator()
        }
        return
    }

    Column {

        // ✅ Date range bar (selector)
        DateRangeBar(
            from = vm.rangeFrom,
            to = vm.rangeTo,
            onPick = { showPicker = true },
            onReset = { vm.resetRangeToDefault() }
        )

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
            items(vm.schedules) { s ->
                Column(Modifier.padding(16.dp)) {
                    /*Text(
                        text = formatDateId(s.start_at, zoneId),
                        style = MaterialTheme.typography.titleMedium
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = "${formatTimeOnly(s.start_at, zoneId)} - ${formatTimeOnly(s.end_at, zoneId)}",
                        style = MaterialTheme.typography.bodyMedium
                    )*/
                    val t = dutyRangeUi(s.start_at, s.end_at, zoneId)

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
                    Spacer(Modifier.height(8.dp))

                    //DutyTypeChip(type = s.schedule_type)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        DutyTypeChip(type = s.schedule_type)
                        StatusChip(status = "APPROVED")
                    }

                    if (!s.title.isNullOrBlank()) {
                        Spacer(Modifier.height(6.dp))
                        Text(text = s.title!!, style = MaterialTheme.typography.bodyMedium)
                    }
                    if (!s.note.isNullOrBlank()) {
                        Spacer(Modifier.height(2.dp))
                        Text(text = s.note!!, style = MaterialTheme.typography.bodySmall)
                    }
                }
                Divider()
            }
        }
    }

    if (showPicker) {
        DateRangePickerDialog(
            initialFrom = vm.rangeFrom,
            initialTo = vm.rangeTo,
            onDismiss = { showPicker = false },
            onApply = { f, t ->
                showPicker = false
                vm.setRange(f, t)
            }
        )
    }
}

@Composable
private fun DateRangeBar(
    from: LocalDate?,
    to: LocalDate?,
    onPick: () -> Unit,
    onReset: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Column(Modifier.weight(1f)) {
            Text("Range Tanggal", style = MaterialTheme.typography.labelMedium)
            val text = if (from != null && to != null) {
                "${formatLocalDateId(from)} - ${formatLocalDateId(to)}"
            } else "-"
            Text(
                text = text,
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold
            )
        }

        Spacer(Modifier.height(0.dp))

        OutlinedButton(onClick = onPick) { Text("Pilih") }
        TextButton(onClick = onReset) { Text("Reset") }
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
                        // picker return millis; convert to LocalDate (UTC)
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
