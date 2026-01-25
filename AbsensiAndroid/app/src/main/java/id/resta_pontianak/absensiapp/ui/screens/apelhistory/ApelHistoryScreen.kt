package id.resta_pontianak.absensiapp.ui.screens.apelhistory

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Badge
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DateRangePicker
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.data.network.AttendanceApelDto
import id.resta_pontianak.absensiapp.ui.helper.SetStatusBar
import id.resta_pontianak.absensiapp.ui.helper.DateRangeUtils
import id.resta_pontianak.absensiapp.ui.screens.dashboard.BlueHeader
import kotlinx.datetime.LocalDate
import kotlinx.datetime.toJavaLocalDate
import kotlinx.datetime.Instant
import kotlinx.datetime.TimeZone
import kotlinx.datetime.toLocalDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale
import androidx.compose.material3.rememberDateRangePickerState

private val ID_DATE = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale("id", "ID"))
private val ID_TIME = DateTimeFormatter.ofPattern("HH:mm", Locale("id", "ID"))
private val TZ_WIB = TimeZone.of("Asia/Jakarta")

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ApelHistoryScreen(
    from: LocalDate,
    to: LocalDate,
    loading: Boolean,
    error: String?,
    items: List<AttendanceApelDto>,
    onBack: () -> Unit,
    onRetry: () -> Unit,
    onApplyRange: (LocalDate, LocalDate) -> Unit,
) {
    SetStatusBar(BlueHeader, false)

    var showPicker by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Riwayat Apel") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BlueHeader,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                )
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            FilterCard(
                from = from,
                to = to,
                onPick = { showPicker = true },
                onReset = {
                    val r = DateRangeUtils.currentMonthRangeJakarta()
                    onApplyRange(r.first, r.second)
                }
            )

            Spacer(Modifier.height(8.dp))

            when {
                loading -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        CircularProgressIndicator()
                    }
                }

                error != null -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text("Gagal memuat riwayat apel")
                            Text(error)
                            Button(onClick = onRetry) {
                                Text("Coba lagi")
                            }
                        }
                    }
                }

                items.isEmpty() -> {
                    Box(
                        modifier = Modifier
                            .fillMaxSize()
                            .padding(16.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Text("Belum ada riwayat apel pada periode ini")
                    }
                }

                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize()
                    ) {
                        items(items) { row ->
                            ApelHistoryRow(row)
                        }
                        item { Spacer(Modifier.height(12.dp)) }
                    }
                }
            }
        }
    }

    if (showPicker) {
        DateRangePickerDialog(
            initialFrom = from,
            initialTo = to,
            onDismiss = { showPicker = false },
            onApply = { f, t ->
                showPicker = false
                onApplyRange(f, t)
            }
        )
    }
}

@Composable
private fun ApelHistoryRow(row: AttendanceApelDto) {
    // work_date sudah yyyy-MM-dd
    val workDateText = runCatching {
        val d = java.time.LocalDate.parse(row.workDate)
        d.format(ID_DATE)
    }.getOrElse { row.workDate }

    val badgeText = (row.kind ?: "").trim().uppercase(Locale.getDefault())
        .replace("MALAM", "SORE")
        .ifBlank { "APEL" }

    val timeWibText = row.occurredAt
        ?.takeIf { it.isNotBlank() }
        ?.let { iso ->
            runCatching {
                val inst = Instant.parse(iso)
                val ldt = inst.toLocalDateTime(TZ_WIB)
                java.time.LocalTime.of(ldt.hour, ldt.minute).format(ID_TIME) + " WIB"
            }.getOrNull()
        }

    Card(
        modifier = Modifier
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Column(Modifier.padding(12.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(workDateText, fontWeight = FontWeight.SemiBold)
                    if (timeWibText != null) {
                        Spacer(Modifier.height(2.dp))
                        Text(
                            timeWibText,
                            style = MaterialTheme.typography.bodySmall,
                            color = Color(0xFF6B7280)
                        )
                    }
                }
                Badge {
                    Text(
                        badgeText,
                        modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
                        style = MaterialTheme.typography.labelMedium
                    )
                }
            }

            if (!row.sourceEvent.isNullOrBlank()) {
                Spacer(Modifier.height(8.dp))
                Text(
                    "Sumber: ${row.sourceEvent}",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF6B7280)
                )
            }
        }
    }
}

@Composable
private fun FilterCard(
    from: LocalDate,
    to: LocalDate,
    onPick: () -> Unit,
    onReset: () -> Unit,
) {
    Card(
        modifier = Modifier
            .padding(horizontal = 12.dp, vertical = 10.dp)
            .fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = Color.White)
    ) {
        Row(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(modifier = Modifier.weight(1f)) {
                Text("Tanggal", style = MaterialTheme.typography.bodySmall, color = Color(0xFF6B7280))
                Spacer(Modifier.height(6.dp))
                Text(
                    "${from.toJavaLocalDate().format(ID_DATE)} - ${to.toJavaLocalDate().format(ID_DATE)}",
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold
                )
            }
            OutlinedButton(onClick = onPick) {
                Icon(Icons.Default.DateRange, contentDescription = null)
                Spacer(Modifier.width(8.dp))
                Text("Pilih")
            }
            Spacer(Modifier.width(8.dp))
            TextButton(onClick = onReset) { Text("Reset") }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DateRangePickerDialog(
    initialFrom: LocalDate,
    initialTo: LocalDate,
    onDismiss: () -> Unit,
    onApply: (LocalDate, LocalDate) -> Unit
) {
    // Material3 picker pakai millis; kita treat millis sebagai UTC date (konsisten dengan screen lain)
    val initialStartMs = remember(initialFrom) {
        java.time.LocalDate.of(initialFrom.year, initialFrom.monthNumber, initialFrom.dayOfMonth)
            .atStartOfDay(java.time.ZoneOffset.UTC)
            .toInstant()
            .toEpochMilli()
    }
    val initialEndMs = remember(initialTo) {
        java.time.LocalDate.of(initialTo.year, initialTo.monthNumber, initialTo.dayOfMonth)
            .atStartOfDay(java.time.ZoneOffset.UTC)
            .toInstant()
            .toEpochMilli()
    }

    val state = rememberDateRangePickerState(
        initialSelectedStartDateMillis = initialStartMs,
        initialSelectedEndDateMillis = initialEndMs,
    )

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

                        val f = LocalDate(start.year, start.monthNumber, start.dayOfMonth)
                        val t = LocalDate(end.year, end.monthNumber, end.dayOfMonth)

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
