package id.resta_pontianak.absensiapp.ui.screens.history

import android.app.Activity
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowInsetsControllerCompat
import coil.ImageLoader
import coil.compose.AsyncImage
import id.resta_pontianak.absensiapp.ui.helper.SetStatusBar
import id.resta_pontianak.absensiapp.ui.screens.dashboard.BlueHeader
import kotlinx.coroutines.flow.StateFlow
import kotlinx.datetime.LocalDate
import java.util.Calendar
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.datetime.toJavaLocalDate
import kotlinx.datetime.toJavaLocalDateTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceHistoryScreen(
    state: StateFlow<AttendanceHistoryViewModel.State>,
    onBack: () -> Unit,

    onPickFrom: (LocalDate) -> Unit,
    onPickTo: (LocalDate) -> Unit,
    onApply: () -> Unit,
    onResetMonth: () -> Unit,

    onOpenDetail: (AttendanceDayUi) -> Unit,
    onCloseDetail: () -> Unit,

    onPreviewPhoto: (String) -> Unit,
    onClosePhoto: () -> Unit,

    onConsumeError: () -> Unit,

    selfieUrl: (String) -> String,
    imageLoader: ImageLoader
) {
    val s by state.collectAsState()

    val snackbarHost = remember { SnackbarHostState() }
    LaunchedEffect(s.error) {
        s.error?.let {
            snackbarHost.showSnackbar(it)
            onConsumeError()
        }
    }

    val ctx = LocalContext.current
    SetStatusBar(BlueHeader, false)

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHost) },
        topBar = {
            TopAppBar(
                title = { Text("Riwayat Absensi") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
                },
                actions = {
                    TextButton(onClick = onResetMonth) { Text("Bulan Ini", color = Color.White) }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BlueHeader,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
                //windowInsets = WindowInsets(0, 0, 0, 0) // opsional: bikin lebih rapat ke atas
            )
        }
    ) { padding ->

        Column(
            Modifier
                .padding(padding)
                .fillMaxSize()
        ) {
            FilterBar(
                from = s.from,
                to = s.to,
                isLoading = s.isLoading,
                onPickFrom = { showDatePicker(ctx, s.from, onPickFrom) },
                onPickTo = { showDatePicker(ctx, s.to, onPickTo) },
                onApply = onApply
            )

            Spacer(Modifier.height(8.dp))

            when {
                s.isLoading && s.items.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                s.items.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Tidak ada data pada rentang tanggal ini.")
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(s.items, key = { it.workDate.toString() }) { item ->
                            AttendanceHistoryCard(
                                item = item,
                                onClick = { onOpenDetail(item) }
                            )
                        }
                    }
                }
            }
        }

        if (s.selected != null) {
            ModalBottomSheet(
                onDismissRequest = onCloseDetail,
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            ) {
                AttendanceHistoryDetail(
                    item = s.selected!!,
                    onPreviewPhoto = onPreviewPhoto,
                    onClose = onCloseDetail
                )
            }
        }

        if (s.photoKey != null) {
            PhotoPreviewDialog(
                objectKey = s.photoKey!!,
                selfieUrl = selfieUrl,
                onClose = onClosePhoto,
                imageLoader = imageLoader
            )
        }
    }
}

@Composable
private fun FilterBar(
    from: LocalDate,
    to: LocalDate,
    isLoading: Boolean,
    onPickFrom: () -> Unit,
    onPickTo: () -> Unit,
    onApply: () -> Unit
) {
    Card(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
        Column(Modifier.padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onPickFrom,
                    enabled = !isLoading
                ) { Text("Dari: $from") }

                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onPickTo,
                    enabled = !isLoading
                ) { Text("Sampai: $to") }
            }

            Spacer(Modifier.height(10.dp))

            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = onApply,
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(10.dp))
                }
                Text("Terapkan")
            }
        }
    }
}

@Composable
private fun AttendanceHistoryCard(
    item: AttendanceDayUi,
    onClick: () -> Unit
) {
    val inTime = item.checkInAtLocal?.formatTime() ?: "—"
    val outTime = item.checkOutAtLocal?.formatTime() ?: "—"

    val hasIn = item.checkInAtLocal != null
    val hasOut = item.checkOutAtLocal != null
    val baseChip = when {
        hasIn && hasOut -> "IN+OUT"
        hasIn -> "IN"
        hasOut -> "OUT"
        else -> null
    }

    val isTidakSah = item.statusIn?.equals("Tanpa Absen", ignoreCase = true) == true && (hasIn || hasOut)

    /*val statusChip = when {
        item.checkInAtLocal != null && item.checkOutAtLocal != null -> "IN+OUT"
        item.checkInAtLocal != null -> "IN"
        item.checkOutAtLocal != null -> "OUT"
        !item.statusIn.isNullOrBlank() -> item.statusIn!!
        else -> "—"
    }*/

    val statusChip = when {
        isTidakSah && baseChip != null -> "$baseChip • TIDAK SAH"
        baseChip != null -> baseChip
        !item.statusIn.isNullOrBlank() -> item.statusIn!!
        else -> "—"
    }

    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(item.workDateLabel(), style = MaterialTheme.typography.titleSmall)
                //AssistChip(onClick = {}, label = { Text(statusChip) })
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {

                    // 🔵 BADGE DUTY (SELALU TAMPIL JIKA ADA DUTY SCHEDULE)
                    if (item.hasDutySchedule) {
                        StatusChip(
                            label = "DUTY",
                            kind = ChipKind.Duty
                        )
                    }

                    /*val kind = when (statusChip) {
                        "IN+OUT", "IN", "OUT" -> ChipKind.Neutral
                        else -> chipKindFromStatus(item.statusIn)
                    }*/
                    val kind = when {
                        isTidakSah -> ChipKind.Error
                        statusChip == "IN+OUT" || statusChip == "IN" || statusChip == "OUT" -> ChipKind.Neutral
                        else -> chipKindFromStatus(item.statusIn)
                    }

                    StatusChip(label = statusChip, kind = kind)
                }

            }

            // badge tipe hari (opsional)
            if (!item.dayType.isNullOrBlank() && item.dayType != "WORKDAY") {
                Spacer(Modifier.height(6.dp))
                val label = when (item.dayType) {
                    "HALF_DAY" -> "Half Day"
                    "HOLIDAY" -> "Libur"
                    else -> item.dayType!!
                }
                //AssistChip(onClick = {}, label = { Text(label) })
                StatusChip(
                    label = label,
                    kind = if (item.dayType == "HOLIDAY") ChipKind.Warning else ChipKind.Neutral
                )
            }

            Spacer(Modifier.height(6.dp))
            Text("${item.fullName} • ${item.nrp}")
            Text(
                if (item.satkerCode.isNullOrBlank()) item.satkerName else "${item.satkerName} (${item.satkerCode})",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(10.dp))
            CheckRow(
                title = "Masuk",
                time = inTime,
                status = item.statusIn,
                detail = item.statusDetailIn,
                distanceM = item.checkInDistanceM,
                extraTopRight = item.lateMinutes?.takeIf { it > 0 }?.let { "+ ${it} m" },
                extraSub = item.attendanceLeaveTypeIn
                    ?.takeIf { it.isNotBlank() && !it.equals("NORMAL", true) }
            )
            Spacer(Modifier.height(6.dp))
            CheckRow(
                title = "Keluar",
                time = outTime,
                status = item.statusOut,
                detail = item.statusDetailOut,
                distanceM = item.checkOutDistanceM,
                extraTopRight = item.earlyOutMinutes?.takeIf { it > 0 }?.let { "- ${it} m" },
                extraSub = item.attendanceLeaveTypeOut
                    ?.takeIf { it.isNotBlank() && !it.equals("NORMAL", true) }
            )
        }
    }
}

@Composable
private fun CheckRow(
    title: String,
    time: String,
    status: String?,
    detail: String?,
    distanceM: Double?,
    extraTopRight: String? = null,
    extraSub: String? = null,
) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Column(Modifier.weight(1f)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("$title: $time", style = MaterialTheme.typography.bodyMedium)
                if (!extraTopRight.isNullOrBlank()) {
                    Text(extraTopRight, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            val stKind = chipKindFromStatus(status)
            val stColor = when (stKind) {
                ChipKind.Error -> MaterialTheme.colorScheme.error
                ChipKind.Duty -> MaterialTheme.colorScheme.secondary
                ChipKind.Leave -> MaterialTheme.colorScheme.tertiary
                ChipKind.Normal -> MaterialTheme.colorScheme.primary
                ChipKind.Remote -> MaterialTheme.colorScheme.secondary
                else -> MaterialTheme.colorScheme.onSurfaceVariant
            }
            if (!status.isNullOrBlank()) {
                Text(status, style = MaterialTheme.typography.bodySmall, color = stColor)
            }
            if (!detail.isNullOrBlank()) {
                Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            if (!extraSub.isNullOrBlank()) {
                Text(extraSub, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (distanceM != null) {
            Text("± ${distanceM.toInt()} m", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AttendanceHistoryDetail(
    item: AttendanceDayUi,
    onPreviewPhoto: (String) -> Unit,
    onClose: () -> Unit
) {
    Column(Modifier.padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Detail", style = MaterialTheme.typography.titleMedium)
            TextButton(onClick = onClose) { Text("Tutup") }
        }

        Text(item.workDateLabel(), style = MaterialTheme.typography.titleSmall)
        Text("${item.fullName} • ${item.nrp}")
        Text(
            if (item.satkerCode.isNullOrBlank()) item.satkerName else "${item.satkerName} (${item.satkerCode})",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(12.dp))

        val hasIn = item.checkInAtLocal != null
        val hasOut = item.checkOutAtLocal != null
        val baseChip = when {
            hasIn && hasOut -> "IN+OUT"
            hasIn -> "IN"
            hasOut -> "OUT"
            else -> null
        }

        val isTidakSah = item.statusIn?.equals("Tanpa Absen", ignoreCase = true) == true && (hasIn || hasOut)

        if (isTidakSah && baseChip != null) {
            AssistChip(
                onClick = {},
                label = { Text("$baseChip • TIDAK SAH") },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    labelColor = MaterialTheme.colorScheme.onErrorContainer
                )
            )
            Spacer(Modifier.height(12.dp))
        }

        if (item.hasDutySchedule) {
            val dutyLabel = when {
                !item.dutyTitle.isNullOrBlank() && !item.dutyNote.isNullOrBlank() ->
                    "Duty: ${item.dutyTitle} • ${item.dutyNote}"
                !item.dutyTitle.isNullOrBlank() ->
                    "Duty: ${item.dutyTitle}"
                !item.dutyNote.isNullOrBlank() ->
                    "Duty: ${item.dutyNote}"
                else ->
                    "Duty Schedule (${item.dutyCount})"
            }

            AssistChip(
                onClick = {},
                label = { Text(dutyLabel) },
                colors = AssistChipDefaults.assistChipColors(
                    containerColor = MaterialTheme.colorScheme.secondaryContainer,
                    labelColor = MaterialTheme.colorScheme.onSecondaryContainer
                )
            )
            Spacer(Modifier.height(12.dp))
        }

        DetailSection(
            title = "Check-in",
            time = item.checkInAtLocal?.formatTime(),
            subtitle = item.checkInSubtitle(),
            notes = item.checkInLeaveNotes,
            distanceM = item.checkInDistanceM,
            deviceId = item.checkInDeviceId,
            deviceName = item.checkInDeviceName,
            deviceModel = item.checkInDeviceModel,
            selfieKey = item.checkInSelfieKey,
            onPreviewPhoto = onPreviewPhoto
        )

        Spacer(Modifier.height(10.dp))

        DetailSection(
            title = "Check-out",
            time = item.checkOutAtLocal?.formatTime(),
            subtitle = item.checkOutSubtitle(),
            notes = item.checkOutLeaveNotes,
            distanceM = item.checkOutDistanceM,
            deviceId = item.checkOutDeviceId,
            deviceName = item.checkOutDeviceName,
            deviceModel = item.checkOutDeviceModel,
            selfieKey = item.checkOutSelfieKey,
            onPreviewPhoto = onPreviewPhoto
        )

        Spacer(Modifier.height(18.dp))
    }
}

@Composable
private fun DetailSection(
    title: String,
    time: String?,
    subtitle: String?,
    notes: String?,
    distanceM: Double?,
    deviceId: String?,
    deviceName: String?,
    deviceModel: String?,
    selfieKey: String?,
    onPreviewPhoto: (String) -> Unit
) {
    ElevatedCard {
        Column(Modifier.padding(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(6.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Jam: ${time ?: "—"}")
                if (distanceM != null) Text("± ${distanceM.toInt()} m", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (!subtitle.isNullOrBlank()) Text("Status: $subtitle")
            if (!notes.isNullOrBlank()) Text("Catatan: $notes")

            Spacer(Modifier.height(8.dp))
            if (!deviceId.isNullOrBlank()) Text("Device ID: $deviceId", style = MaterialTheme.typography.bodySmall)
            if (!deviceName.isNullOrBlank()) Text("Device Name: $deviceName", style = MaterialTheme.typography.bodySmall)
            if (!deviceModel.isNullOrBlank()) Text("Device Model: $deviceModel", style = MaterialTheme.typography.bodySmall)

            if (!selfieKey.isNullOrBlank()) {
                Spacer(Modifier.height(10.dp))
                Button(onClick = { onPreviewPhoto(selfieKey) }) { Text("Lihat Foto") }
            }
        }
    }
}

@Composable
private fun PhotoPreviewDialog(
    objectKey: String,
    imageLoader: ImageLoader,
    selfieUrl: (String) -> String,
    onClose: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onClose,
        confirmButton = { TextButton(onClick = onClose) { Text("Tutup") } },
        title = { Text("Foto Selfie") },
        text = {
            Column {
                AsyncImage(
                    model = selfieUrl(objectKey),
                    imageLoader = imageLoader, // ✅ pakai client yg sama
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(360.dp)
                )
                Spacer(Modifier.height(8.dp))
                Text(objectKey, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    )
}

/** ---------- helpers ---------- */
private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm", Locale("id", "ID"))
private val DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale("id", "ID"))

private enum class ChipKind { Neutral, Normal, Warning, Error, Duty, Leave, Remote }

private fun chipKindFromStatus(status: String?): ChipKind {
    val s = status?.trim()?.uppercase().orEmpty()
    return when (s) {
        "" -> ChipKind.Neutral
        "NORMAL" -> ChipKind.Normal
        "TANPA ABSEN" -> ChipKind.Error
        "DUTY" -> ChipKind.Duty

        // leave (dari leave request approved)
        "SAKIT", "CUTI", "IJIN" -> ChipKind.Leave

        // remote
        "WFA", "WFH" -> ChipKind.Remote

        // fallback: kalau ada string lain (mis dinas luar tapi approved)
        else -> ChipKind.Warning
    }
}

@Composable
private fun StatusChip(
    label: String,
    kind: ChipKind,
    modifier: Modifier = Modifier
) {
    val cs = MaterialTheme.colorScheme
    val colors = when (kind) {
        ChipKind.Neutral -> AssistChipDefaults.assistChipColors(
            containerColor = cs.surfaceVariant,
            labelColor = cs.onSurfaceVariant
        )
        ChipKind.Normal -> AssistChipDefaults.assistChipColors(
            containerColor = cs.primaryContainer,
            labelColor = cs.onPrimaryContainer
        )
        ChipKind.Duty -> AssistChipDefaults.assistChipColors(
            containerColor = cs.secondaryContainer,
            labelColor = cs.onSecondaryContainer
        )
        ChipKind.Leave -> AssistChipDefaults.assistChipColors(
            containerColor = cs.tertiaryContainer,
            labelColor = cs.onTertiaryContainer
        )
        ChipKind.Remote -> AssistChipDefaults.assistChipColors(
            containerColor = cs.secondaryContainer,
            labelColor = cs.onSecondaryContainer
        )
        ChipKind.Warning -> AssistChipDefaults.assistChipColors(
            containerColor = cs.inversePrimary,
            labelColor = cs.onPrimaryContainer
        )
        ChipKind.Error -> AssistChipDefaults.assistChipColors(
            containerColor = cs.errorContainer,
            labelColor = cs.onErrorContainer
        )
    }

    AssistChip(
        onClick = {}, // non-interaktif
        label = { Text(label) },
        colors = colors,
        modifier = modifier
    )
}

private fun kotlinx.datetime.LocalDateTime.formatTime(): String =
    TIME_FMT.format(this.toJavaLocalDateTime())

private fun AttendanceDayUi.workDateLabel(): String =
    DATE_FMT.format(this.workDate.toJavaLocalDate())

private fun AttendanceDayUi.checkInSubtitle(): String? {
    // priority sudah diset di ViewModel (leave > duty > attendance > missing)
    val st = statusIn?.trim().orEmpty()
    if (st.isBlank()) return null
    if (st.equals("Normal", ignoreCase = true)) {
        // untuk normal, detail = geofence name
        return listOfNotNull("Normal", statusDetailIn?.takeIf { it.isNotBlank() }).joinToString(" • ")
    }
    // leave/duty/tanpa absen/dll
    return listOfNotNull(st, statusDetailIn?.takeIf { it.isNotBlank() }).joinToString(" • ")
}

private fun AttendanceDayUi.checkOutSubtitle(): String? {
    val st = statusOut?.trim().orEmpty()
    if (st.isBlank()) return null
    if (st.equals("Normal", ignoreCase = true)) {
        return listOfNotNull("Normal", statusDetailOut?.takeIf { it.isNotBlank() }).joinToString(" • ")
    }
    return listOfNotNull(st, statusDetailOut?.takeIf { it.isNotBlank() }).joinToString(" • ")
}

private fun showDatePicker(
    context: Context,
    initial: LocalDate,
    onPicked: (LocalDate) -> Unit
) {
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


/*
package id.resta_pontianak.absensiapp.ui.screens.history

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
import coil.ImageLoader
import coil.compose.AsyncImage
import kotlinx.coroutines.flow.StateFlow
import kotlinx.datetime.LocalDate
import java.util.Calendar
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.datetime.toJavaLocalDate
import kotlinx.datetime.toJavaLocalDateTime

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceHistoryScreen(
    state: StateFlow<AttendanceHistoryViewModel.State>,
    onBack: () -> Unit,

    onPickFrom: (LocalDate) -> Unit,
    onPickTo: (LocalDate) -> Unit,
    onApply: () -> Unit,
    onResetMonth: () -> Unit,

    onOpenDetail: (AttendanceSessionUi) -> Unit,
    onCloseDetail: () -> Unit,

    onPreviewPhoto: (String) -> Unit,
    onClosePhoto: () -> Unit,

    onConsumeError: () -> Unit,

    selfieUrl: (String) -> String,
    imageLoader: ImageLoader
) {
    val s by state.collectAsState()

    val snackbarHost = remember { SnackbarHostState() }
    LaunchedEffect(s.error) {
        s.error?.let {
            snackbarHost.showSnackbar(it)
            onConsumeError()
        }
    }

    val ctx = LocalContext.current

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHost) },
        topBar = {
            TopAppBar(
                title = { Text("Riwayat Absensi") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
                },
                actions = {
                    TextButton(onClick = onResetMonth) { Text("Bulan Ini") }
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
            FilterBar(
                from = s.from,
                to = s.to,
                isLoading = s.isLoading,
                onPickFrom = { showDatePicker(ctx, s.from, onPickFrom) },
                onPickTo = { showDatePicker(ctx, s.to, onPickTo) },
                onApply = onApply
            )

            Spacer(Modifier.height(8.dp))

            when {
                s.isLoading && s.items.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator()
                    }
                }
                s.items.isEmpty() -> {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Tidak ada data pada rentang tanggal ini.")
                    }
                }
                else -> {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(12.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        items(s.items, key = { it.sessionId }) { item ->
                            AttendanceHistoryCard(
                                item = item,
                                onClick = { onOpenDetail(item) }
                            )
                        }
                    }
                }
            }
        }

        if (s.selected != null) {
            ModalBottomSheet(
                onDismissRequest = onCloseDetail,
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            ) {
                AttendanceHistoryDetail(
                    item = s.selected!!,
                    onPreviewPhoto = onPreviewPhoto,
                    onClose = onCloseDetail
                )
            }
        }

        if (s.photoKey != null) {
            PhotoPreviewDialog(
                objectKey = s.photoKey!!,
                selfieUrl = selfieUrl,
                onClose = onClosePhoto,
                imageLoader = imageLoader
            )
        }
    }
}

@Composable
private fun FilterBar(
    from: LocalDate,
    to: LocalDate,
    isLoading: Boolean,
    onPickFrom: () -> Unit,
    onPickTo: () -> Unit,
    onApply: () -> Unit
) {
    Card(Modifier.padding(horizontal = 12.dp, vertical = 10.dp)) {
        Column(Modifier.padding(12.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onPickFrom,
                    enabled = !isLoading
                ) { Text("Dari: $from") }

                OutlinedButton(
                    modifier = Modifier.weight(1f),
                    onClick = onPickTo,
                    enabled = !isLoading
                ) { Text("Sampai: $to") }
            }

            Spacer(Modifier.height(10.dp))

            Button(
                modifier = Modifier.fillMaxWidth(),
                onClick = onApply,
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(10.dp))
                }
                Text("Terapkan")
            }
        }
    }
}

@Composable
private fun AttendanceHistoryCard(
    item: AttendanceSessionUi,
    onClick: () -> Unit
) {
    val inTime = item.checkInAtLocal?.formatTime() ?: "—"
    val outTime = item.checkOutAtLocal?.formatTime() ?: "—"
    val status = when {
        item.checkInAtLocal != null && item.checkOutAtLocal != null -> "IN+OUT"
        item.checkInAtLocal != null -> "IN"
        item.checkOutAtLocal != null -> "OUT"
        else -> "—"
    }

    Card(onClick = onClick, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(item.workDateLabel(), style = MaterialTheme.typography.titleSmall)
                AssistChip(onClick = {}, label = { Text(status) })
            }

            Spacer(Modifier.height(6.dp))
            Text("${item.fullName} • ${item.nrp}")
            Text(
                if (item.satkerCode.isNullOrBlank()) item.satkerName else "${item.satkerName} (${item.satkerCode})",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(10.dp))
            CheckRow("Masuk", inTime, item.checkInSubtitle, item.checkInDistanceM)
            Spacer(Modifier.height(6.dp))
            CheckRow("Keluar", outTime, item.checkOutSubtitle, item.checkOutDistanceM)
        }
    }
}

@Composable
private fun CheckRow(title: String, time: String, subtitle: String?, distanceM: Double?) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Column(Modifier.weight(1f)) {
            Text("$title: $time", style = MaterialTheme.typography.bodyMedium)
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        if (distanceM != null) {
            Text("± ${distanceM.toInt()} m", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
private fun AttendanceHistoryDetail(
    item: AttendanceSessionUi,
    onPreviewPhoto: (String) -> Unit,
    onClose: () -> Unit
) {
    Column(Modifier.padding(16.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Detail", style = MaterialTheme.typography.titleMedium)
            TextButton(onClick = onClose) { Text("Tutup") }
        }

        Text(item.workDateLabel(), style = MaterialTheme.typography.titleSmall)
        Text("${item.fullName} • ${item.nrp}")
        Text(
            if (item.satkerCode.isNullOrBlank()) item.satkerName else "${item.satkerName} (${item.satkerCode})",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(12.dp))

        DetailSection(
            title = "Check-in",
            time = item.checkInAtLocal?.formatTime(),
            subtitle = item.checkInSubtitle,
            notes = item.checkInLeaveNotes,
            distanceM = item.checkInDistanceM,
            deviceId = item.checkInDeviceId,
            deviceName = item.checkInDeviceName,
            deviceModel = item.checkInDeviceModel,
            selfieKey = item.checkInSelfieKey,
            onPreviewPhoto = onPreviewPhoto
        )

        Spacer(Modifier.height(10.dp))

        DetailSection(
            title = "Check-out",
            time = item.checkOutAtLocal?.formatTime(),
            subtitle = item.checkOutSubtitle,
            notes = item.checkOutLeaveNotes,
            distanceM = item.checkOutDistanceM,
            deviceId = item.checkOutDeviceId,
            deviceName = item.checkOutDeviceName,
            deviceModel = item.checkOutDeviceModel,
            selfieKey = item.checkOutSelfieKey,
            onPreviewPhoto = onPreviewPhoto
        )

        Spacer(Modifier.height(18.dp))
    }
}

@Composable
private fun DetailSection(
    title: String,
    time: String?,
    subtitle: String?,
    notes: String?,
    distanceM: Double?,
    deviceId: String?,
    deviceName: String?,
    deviceModel: String?,
    selfieKey: String?,
    onPreviewPhoto: (String) -> Unit
) {
    ElevatedCard {
        Column(Modifier.padding(12.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall)
            Spacer(Modifier.height(6.dp))

            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Jam: ${time ?: "—"}")
                if (distanceM != null) Text("± ${distanceM.toInt()} m", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (!subtitle.isNullOrBlank()) Text("Status: $subtitle")
            if (!notes.isNullOrBlank()) Text("Catatan: $notes")

            Spacer(Modifier.height(8.dp))
            if (!deviceId.isNullOrBlank()) Text("Device ID: $deviceId", style = MaterialTheme.typography.bodySmall)
            if (!deviceName.isNullOrBlank()) Text("Device Name: $deviceName", style = MaterialTheme.typography.bodySmall)
            if (!deviceModel.isNullOrBlank()) Text("Device Model: $deviceModel", style = MaterialTheme.typography.bodySmall)

            if (!selfieKey.isNullOrBlank()) {
                Spacer(Modifier.height(10.dp))
                Button(onClick = { onPreviewPhoto(selfieKey) }) { Text("Lihat Foto") }
            }
        }
    }
}

@Composable
private fun PhotoPreviewDialog(
    objectKey: String,
    imageLoader: ImageLoader,
    selfieUrl: (String) -> String,
    onClose: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onClose,
        confirmButton = { TextButton(onClick = onClose) { Text("Tutup") } },
        title = { Text("Foto Selfie") },
        text = {
            Column {
                AsyncImage(
                    model = selfieUrl(objectKey),
                    imageLoader = imageLoader, // ✅ pakai client yg sama
                    contentDescription = null,
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(360.dp)
                )
                Spacer(Modifier.height(8.dp))
                Text(objectKey, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    )
}

*/
/** ---------- helpers ---------- *//*

private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm", Locale("id", "ID"))
private val DATE_FMT = DateTimeFormatter.ofPattern("dd MMM yyyy", Locale("id", "ID"))

private fun kotlinx.datetime.LocalDateTime.formatTime(): String =
    TIME_FMT.format(this.toJavaLocalDateTime())

private fun AttendanceSessionUi.workDateLabel(): String =
    DATE_FMT.format(this.workDate.toJavaLocalDate())

private fun showDatePicker(
    context: Context,
    initial: LocalDate,
    onPicked: (LocalDate) -> Unit
) {
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
*/
