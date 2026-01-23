package id.resta_pontianak.absensiapp.ui.screens.tukin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Divider
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.data.network.TukinDayDto
import id.resta_pontianak.absensiapp.ui.helper.SetStatusBar
import id.resta_pontianak.absensiapp.ui.screens.dashboard.BlueHeader
import kotlinx.datetime.TimeZone
import java.text.NumberFormat
import java.time.LocalDate
import java.time.YearMonth
import java.time.format.DateTimeFormatter
import java.util.Locale

private val LOCALE_ID = Locale("id", "ID")
private val fmtTanggalId = DateTimeFormatter.ofPattern("d MMM yyyy", LOCALE_ID)
private val fmtBulanTahunId = DateTimeFormatter.ofPattern("MMMM yyyy", LOCALE_ID)

private fun formatWorkDateId(workDate: String): String {
    return runCatching { LocalDate.parse(workDate).format(fmtTanggalId) }.getOrElse { workDate }
}

private fun formatMonthId(ym: String): String {
    return runCatching { YearMonth.parse(ym).atDay(1).format(fmtBulanTahunId) }.getOrElse { ym }
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun TukinHistoryScreen(
    stateFlow: kotlinx.coroutines.flow.StateFlow<TukinHistoryViewModel.State>,
    onBack: () -> Unit,
    onPickMonth: (String) -> Unit,
    onGenerate: () -> Unit,
    onConsumeSnack: () -> Unit
) {
    val s by stateFlow.collectAsState()

    val snackbarHostState = remember { SnackbarHostState() }
    LaunchedEffect(s.snack) {
        val msg = s.snack ?: return@LaunchedEffect
        snackbarHostState.showSnackbar(msg)
        onConsumeSnack()
    }

    val nf = remember { NumberFormat.getNumberInstance(LOCALE_ID) }

    val tz = remember(s.timezone) {
        runCatching { TimeZone.of(s.timezone) }.getOrElse { TimeZone.of("Asia/Jakarta") }
    }

    val calc = s.calc
    val rawDays = calc?.breakdown?.days ?: emptyList()
    val days = remember(rawDays, tz) { filterUpToTodayAndExcludeHolidays(rawDays, tz) }
    SetStatusBar(BlueHeader, false)
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Riwayat Tukin") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Filled.ArrowBack, contentDescription = "Back")
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BlueHeader,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) }
    ) { pad ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(pad)
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                MonthYearSelector(
                    selectedMonth = s.month,
                    onSelected = onPickMonth
                )
            }

            item {
                Button(
                    onClick = onGenerate,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !s.isLoading
                ) {
                    Text("Generate")
                }
            }

            if (s.isLoading) {
                item { LinearProgressIndicator(modifier = Modifier.fillMaxWidth()) }
            }

            if (s.error != null) {
                item { Text(s.error!!, color = MaterialTheme.colorScheme.error) }
            }

            if (calc == null && s.error == null && !s.isLoading) {
                item {
                    Text(
                        s.emptyHint ?: "Harus generate dulu, tolong tekan tombol Generate",
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }

            if (calc != null) {
                item {
                    SummaryBadges(
                        month = calc.month,
                        baseTukin = calc.base_tukin,
                        expected = calc.expected_units,
                        earned = calc.earned_credit,
                        ratio = calc.attendance_ratio,
                        finalTukin = calc.final_tukin,
                        nf = nf
                    )
                }

                item {
                    Text(
                        text = "Breakdown (sampai hari ini)",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }

                items(days) { d ->
                    BreakdownRowFullWidth(d = d, tz = tz)
                    Divider()
                }
            }
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SummaryBadges(
    month: String,
    baseTukin: Long,
    expected: Double,
    earned: Double,
    ratio: Double,
    finalTukin: Long,
    nf: NumberFormat
) {
    Text(
        text = formatMonthId(month),
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold
    )
    Spacer(Modifier.height(8.dp))

    FlowRow(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        MiniBadge("Base", nf.format(baseTukin))
        MiniBadge("Expected", expected.toString())
        MiniBadge("Earn", earned.toString())
        MiniBadge("Ratio", value = formatRatioPercent(ratio))
        MiniBadge("Final", nf.format(finalTukin), strong = true, highlight = true)
    }
}

@Composable
private fun MiniBadge(
    label: String,
    value: String,
    strong: Boolean = false,
    highlight: Boolean = false
) {
    AssistChip(
        onClick = {},
        colors = if (highlight) {
            AssistChipDefaults.assistChipColors(
                containerColor = MaterialTheme.colorScheme.primaryContainer,
                labelColor = MaterialTheme.colorScheme.onPrimaryContainer
            )
        } else {
            AssistChipDefaults.assistChipColors()
        },
        label = {
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(
                    label,
                    fontWeight = if (strong) FontWeight.SemiBold else FontWeight.Normal
                )
                Text(
                    value,
                    fontWeight = if (strong) FontWeight.Bold else FontWeight.Medium
                )
            }
        }
    )
}

@Composable
private fun chipColorsFor(kind: StatusKind) = when (kind) {
    StatusKind.HADIR -> AssistChipDefaults.assistChipColors(
        containerColor = MaterialTheme.colorScheme.primaryContainer,
        labelColor = MaterialTheme.colorScheme.onPrimaryContainer
    )
    StatusKind.TIDAK_HADIR -> AssistChipDefaults.assistChipColors(
        containerColor = MaterialTheme.colorScheme.errorContainer,
        labelColor = MaterialTheme.colorScheme.onErrorContainer
    )
    StatusKind.LEAVE -> AssistChipDefaults.assistChipColors(
        containerColor = MaterialTheme.colorScheme.tertiaryContainer,
        labelColor = MaterialTheme.colorScheme.onTertiaryContainer
    )
    StatusKind.DUTY -> AssistChipDefaults.assistChipColors(
        containerColor = MaterialTheme.colorScheme.secondaryContainer,
        labelColor = MaterialTheme.colorScheme.onSecondaryContainer
    )
    StatusKind.OTHER -> AssistChipDefaults.assistChipColors(
        containerColor = MaterialTheme.colorScheme.surfaceVariant,
        labelColor = MaterialTheme.colorScheme.onSurfaceVariant
    )
}

@Composable
private fun BreakdownRowFullWidth(d: TukinDayDto, tz: TimeZone) {
    val status = remember(d) { computeStatus(d) }

    Column(Modifier.fillMaxWidth()) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(formatWorkDateId(d.work_date), fontWeight = FontWeight.SemiBold)
            AssistChip(
                onClick = {},
                colors = chipColorsFor(status.kind),
                label = { Text(status.label) }
            )
        }

        Spacer(Modifier.height(6.dp))

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("In: ${formatTimeHHmm(d.check_in_at, tz)}")
            Text("Out: ${formatTimeHHmm(d.check_out_at, tz)}")
        }

        Spacer(Modifier.height(6.dp))

        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Expected: ${d.expected_unit}")
            Text("Earned: ${d.earned_credit}")
        }

        if (!d.leave_type.isNullOrBlank()) {
            Spacer(Modifier.height(4.dp))
            Text(
                "Leave credit: ${d.leave_credit ?: 0.0}",
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }
}

private fun formatRatioPercent(ratio: Double): String {
    return String.format(Locale.US, "%.2f %%", ratio * 100)
}
