package id.resta_pontianak.absensiapp.ui.screens.dashboard

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.asPaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.filled.AssignmentTurnedIn
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Payments
import androidx.compose.material3.Divider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import id.resta_pontianak.absensiapp.R
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.BottomSheetDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.ListItem
import androidx.compose.material3.ListItemDefaults
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Surface
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.vector.ImageVector
import id.resta_pontianak.absensiapp.ui.helper.SetStatusBar


public val BlueHeader = Color(0xFF0B2A5A)
public val BlueCard = Color(0xFF123D8A)
public val BlueCard2 = Color(0xFF0F2F68)
public val Muted = Color(0xFF6B7280)

private enum class AttendanceCardState { Ready, Done, Locked }

private fun hasTime(t: String): Boolean {
    val x = t.trim()
    return x.isNotEmpty() && x != "--:--" && x != "—" && x != "-"
}

@Composable
fun DashboardScreen(
    fullName: String,
    nrp: String,
    satkerName: String,
    workDateText: String?,
    checkInDateText: String?,
    checkInTimeText: String,
    checkOutDateText: String?,
    checkOutTimeText: String,
    checkInEnabled: Boolean,
    checkOutEnabled: Boolean,
    isDuty: Boolean,
    dutyStartText: String?,
    dutyEndText: String?,


    announcementTitle: String,
    announcementBody: String,
    announcementDate: String,
    scheduleBody: String,
    onClickMasuk: () -> Unit,
    onClickKeluar: () -> Unit,
    onClickTunkin: () -> Unit,
    onClickRiwayatApel: () -> Unit,
    onClickSchedule: () -> Unit,
    onClickIjin: () -> Unit,
    //onClickRiwayatAbsen: () -> Unit,
    onLogoutClick: () -> Unit,
    onViewAllAnnouncements: () -> Unit,
    announcements: List<DashboardAnnouncementUi>,
    dutyUpcoming: List<DashboardDutyUi>,
) {

    var selected by remember { mutableStateOf<DashboardAnnouncementUi?>(null) }

    var selectedDuty by remember { mutableStateOf<DashboardDutyUi?>(null) }

    SetStatusBar(BlueHeader, false)

    Column(
        Modifier
            .fillMaxSize()
            .background(Color(0xFFF5F7FB))
    ) {
        Header(fullName = fullName, nrp = nrp, satkerName = satkerName, onLogout = onLogoutClick)

        //Spacer(Modifier.height(12.dp))

        LazyColumn(
            modifier = Modifier
                .fillMaxWidth()
                .weight(1f), // penting biar area ini yang scroll
            contentPadding = androidx.compose.foundation.layout.PaddingValues(
                start = 16.dp,
                end = 16.dp,
                top = 0.dp,
                bottom = 16.dp
            ),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            item {
                if (!workDateText.isNullOrBlank()) {
                    Text(
                        text = workDateText,
                        modifier = Modifier.padding(horizontal = 16.dp),
                        color = Muted,
                        fontWeight = FontWeight.SemiBold
                    )
                }
            }

            item {
                /*val hasIn = hasTime(checkInTime)
                val hasOut = hasTime(checkOutTime)

                val inState = if (!hasIn) AttendanceCardState.Ready else AttendanceCardState.Done
                val outState = when {
                    hasOut -> AttendanceCardState.Done
                    hasIn -> AttendanceCardState.Ready
                    else -> AttendanceCardState.Locked
                }*/
                Row(
                    Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    AttendanceCard(
                        title = "Masuk",
                        dateText = checkInDateText,
                        timeText = checkInTimeText,
                        enabled = checkInEnabled,
                        isDuty = isDuty,
                        //dutyBadgeText = if (isDuty) "DUTY" else null,
                        dutyInfoText = dutyStartText,
                        modifier = Modifier.weight(1f),
                        onClick = onClickMasuk,
                    )
                    AttendanceCard(
                        title = "Keluar",
                        dateText = checkOutDateText,
                        timeText = checkOutTimeText,
                        enabled = checkOutEnabled,
                        isDuty = isDuty,
                        //dutyBadgeText = if (isDuty) "DUTY" else null,
                        dutyInfoText = dutyEndText,
                        modifier = Modifier.weight(1f),
                        onClick = onClickKeluar,
                    )
                }
            }
            item {
                QuickMenu(
                    onClickTunkin = onClickTunkin,
                    onClickSchedule = onClickSchedule,
                    onClickApel = onClickRiwayatApel,
                )
            }

            item {
                AnnouncementCard(
                    announcements = announcements,
                    onViewAll = onViewAllAnnouncements,
                    onOpenDetail = { selected = it }
                )
            }

            item {
                ScheduleCard(
                    items = dutyUpcoming,
                    onOpenDetail = { selectedDuty = it }
                )
            }
        }


    }

    if (selected != null) {
        AnnouncementDetailSheet(
            item = selected!!,
            onDismiss = { selected = null }
        )
    }

    if (selectedDuty != null) {
        DutyDetailSheet(
            item = selectedDuty!!,
            onDismiss = { selectedDuty = null }
        )
    }

}

@Composable
private fun Header(fullName: String, nrp: String, satkerName: String, onLogout: () -> Unit) {
    val topInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()


    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = BlueHeader,
        shape = RoundedCornerShape(
            bottomStart = 24.dp,
            bottomEnd = 24.dp
        )
    ) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .statusBarsPadding()
                .padding(
                    start = 4.dp,
                    end = 16.dp,
                    top = 6.dp,
                    bottom = 24.dp
                )
        ) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.align(Alignment.TopStart)
            ) {
                // ✅ LOGO di kiri
                Image(
                    painter = painterResource(id = R.drawable.logo_pontianak),
                    contentDescription = "Logo Polresta Pontianak",
                    modifier = Modifier.size(80.dp)
                )

                Spacer(Modifier.width(6.dp))

                Column {
                    Text("Selamat Datang", color = Color.White)
                    Spacer(Modifier.height(4.dp))
                    Text(
                        fullName,
                        color = Color.White,
                        fontWeight = FontWeight.SemiBold,
                    )
                    Text(
                        "NRP: $nrp",
                        color = Color.White.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.bodyMedium.copy(lineHeight = 14.sp)
                    )
                    Text(
                        satkerName,
                        color = Color.White.copy(alpha = 0.85f),
                        style = MaterialTheme.typography.bodySmall.copy(lineHeight = 14.sp)
                    )
                }
            }

            IconButton(
                onClick = onLogout,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .size(48.dp)
                    .background(
                        Color.White.copy(alpha = 0.12f),
                        RoundedCornerShape(24.dp)
                    )
            ) {
                Icon(Icons.Default.ExitToApp, contentDescription = "Logout", tint = Color.White)
            }
        }
    }

}

@Composable
private fun AttendanceCard(
    title: String,
    dateText: String?,
    timeText: String,
    enabled: Boolean,
    isDuty: Boolean,
    dutyInfoText: String?,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val containerColor = if (enabled) MaterialTheme.colorScheme.surface else MaterialTheme.colorScheme.surfaceVariant
    val titleColor = if (enabled) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant

    Card(
        onClick = { if (enabled) onClick() },
        enabled = enabled,
        modifier = modifier
            .fillMaxWidth()
            .height(140.dp),
        shape = RoundedCornerShape(14.dp),
        colors = CardDefaults.cardColors(containerColor = containerColor),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(title, fontWeight = FontWeight.SemiBold, color = titleColor)

                if (isDuty) {
                    Surface(
                        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.15f),
                        shape = RoundedCornerShape(999.dp)
                    ) {
                        Text(
                            text = "DUTY",
                            modifier = Modifier.padding(horizontal = 10.dp, vertical = 4.dp),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.primary,
                            fontWeight = FontWeight.SemiBold
                        )
                    }
                }
            }

            Column {
                if (!dateText.isNullOrBlank()) {
                    Text(
                        dateText,
                        style = MaterialTheme.typography.bodySmall,
                        color = Muted
                    )
                    Spacer(Modifier.height(2.dp))
                }

                Text(
                    timeText,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold,
                    color = titleColor
                )

                Spacer(Modifier.height(6.dp))

                val footer = when {
                    isDuty && !dutyInfoText.isNullOrBlank() -> dutyInfoText
                    else -> "Lokasi"
                }
                Text(footer, color = Muted, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}


@Composable
private fun SmallPill(text: String) {
    Surface(
        shape = RoundedCornerShape(999.dp),
        color = Color(0xFFE5E7EB)
    ) {
        Text(
            text = text,
            color = Color(0xFF111827),
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}


/*@Composable
private fun AttendanceCard(
    title: String,
    time: String,
    subtitle: String,
    state: AttendanceCardState,
    badgeText: String? = null,
    extraLine: String? = null,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        enabled = state == AttendanceCardState.Ready,
        modifier = modifier
            .fillMaxWidth()
            .height(140.dp),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Column {
                Text(
                    time,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    if (!badgeText.isNullOrBlank()) {
                        AssistChip(
                            onClick = { },
                            label = { Text(badgeText) },
                            colors = AssistChipDefaults.assistChipColors(
                                containerColor = Color(0xFFE5E7EB),
                                labelColor = Color(0xFF111827)
                            )
                        )
                    }
                    Text(subtitle, color = Muted)
                    if (!extraLine.isNullOrBlank()) {
                        Text(extraLine, color = Muted, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}*/

/*@Composable
private fun AttendanceCard(
    title: String,
    time: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .height(140.dp),
        shape = RoundedCornerShape(14.dp),
        elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Column {
                Text(
                    time,
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                Text(subtitle, color = Muted)
            }
        }
    }
}*/

@Composable
private fun QuickMenu(
    onClickTunkin: () -> Unit,
    onClickSchedule: () -> Unit,
    onClickApel: () -> Unit
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(BlueCard, RoundedCornerShape(18.dp))
            .padding(vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        QuickMenuItem(
            icon = Icons.Filled.Payments,
            label = "Tunjangan Kinerja",
            onClick = onClickTunkin
        )

        QuickMenuItem(
            icon = Icons.Filled.CalendarMonth,
            label = "Jadwal Dinas",
            onClick = onClickSchedule
        )

        QuickMenuItem(
            icon = Icons.Filled.AssignmentTurnedIn, // ✅ Riwayat Apel
            label = "Riwayat Apel",
            onClick = onClickApel
        )
    }
}


@Composable
private fun QuickMenuItem(
    icon: ImageVector,
    label: String,
    onClick: () -> Unit
) {
    Column(
        modifier = Modifier
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Surface(
            shape = CircleShape,
            color = Color.White.copy(alpha = 0.15f),
            modifier = Modifier.size(44.dp)
        ) {
            Box(contentAlignment = Alignment.Center) {
                Icon(
                    imageVector = icon,
                    contentDescription = label,
                    tint = Color.White,
                    modifier = Modifier.size(22.dp)
                )
            }
        }

        Spacer(Modifier.height(6.dp))
        Text(
            text = label,
            color = Color.White,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold
        )
    }
}




@Composable
private fun AnnouncementCard(
    announcements: List<DashboardAnnouncementUi>,
    onViewAll: () -> Unit,
    onOpenDetail: (DashboardAnnouncementUi) -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant
        )
    ) {
        Column {
            // ===== Header =====
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 10.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Icon(
                    imageVector = Icons.Filled.Notifications,
                    contentDescription = null,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.size(18.dp)
                )
                Spacer(Modifier.width(8.dp))
                Text(
                    text = "Pengumuman",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.weight(1f)
                )
                TextButton(onClick = onViewAll) { Text("Lihat Semua") }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

            if (announcements.isEmpty()) {
                Box(
                    Modifier
                        .fillMaxWidth()
                        .padding(14.dp),
                    contentAlignment = Alignment.CenterStart
                ) {
                    Text("-", color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                return@Column
            }

            // ===== Items =====
            val shown = announcements.take(3)

            shown.forEachIndexed { idx, a ->
                // item background PUTIH
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { onOpenDetail(a) },
                    color = Color.White
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Text(
                                text = a.title,
                                fontWeight = FontWeight.SemiBold,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis
                            )
                            Text(
                                text = a.dateLabel,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            if (a.body.isNotBlank()) {
                                Text(
                                    text = a.body,
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 2,
                                    overflow = TextOverflow.Ellipsis
                                )
                            }
                        }

                        Spacer(Modifier.width(12.dp))
                        ScopeBadge(scope = a.scope)
                    }
                }

                if (idx != shown.lastIndex) {
                    HorizontalDivider(
                        modifier = Modifier.fillMaxWidth(),
                        color = MaterialTheme.colorScheme.outlineVariant
                    )
                }
            }
        }
    }
}


@Composable
private fun ScopeBadge(scope: String) {
    val label = scope.trim().uppercase().let {
        when (it) {
            "GLOBAL" -> "GLOBAL"
            "SATKER" -> "SATKER"
            else -> it.ifBlank { "-" }
        }
    }

    val colors = when (label) {
        "GLOBAL" -> AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.primaryContainer,
            labelColor = MaterialTheme.colorScheme.onPrimaryContainer
        )

        "SATKER" -> AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.secondaryContainer,
            labelColor = MaterialTheme.colorScheme.onSecondaryContainer
        )

        else -> AssistChipDefaults.assistChipColors(
            containerColor = MaterialTheme.colorScheme.surfaceVariant,
            labelColor = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }

    AssistChip(
        onClick = {}, // tidak perlu aksi
        label = { Text(label) },
        colors = colors
    )
}


@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AnnouncementDetailSheet(
    item: DashboardAnnouncementUi,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = false)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        val scroll = rememberScrollState()

        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 16.dp)
        ) {
            // Title row + badge
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = item.title,
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(10.dp))
                ScopeBadge(scope = item.scope)
            }

            Spacer(Modifier.height(8.dp))
            Text(
                text = item.dateLabel,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )

            Spacer(Modifier.height(12.dp))
            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
            Spacer(Modifier.height(12.dp))

            // Body scrollable (biar panjang pun enak)
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(min = 120.dp, max = 420.dp)
                    .verticalScroll(scroll)
            ) {
                Text(
                    text = item.body.ifBlank { "-" },
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Spacer(Modifier.height(16.dp))
            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) {
                Text("Tutup")
            }
        }
    }
}


@Composable
private fun ScheduleCard(
    items: List<DashboardDutyUi>,
    onOpenDetail: (DashboardDutyUi) -> Unit
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Column(
            Modifier
                .background(BlueCard2)
                .padding(16.dp)
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Jadwal Dinas", color = Color.White, fontWeight = FontWeight.Bold)
            }

            Spacer(Modifier.height(10.dp))

            if (items.isEmpty()) {
                Text(
                    "Tidak ada jadwal dinas dalam 2 bulan ke depan.",
                    color = Color.White.copy(alpha = 0.9f)
                )
                return@Column
            }

            items.forEachIndexed { idx, itx ->
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(12.dp))
                        .clickable { onOpenDetail(itx) }
                        .padding(vertical = 10.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                itx.line1,
                                color = Color.White,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(Modifier.width(8.dp))
                            ScheduleTypeBadge(type = itx.scheduleType)
                        }

                        if (!itx.line2.isNullOrBlank()) {
                            Spacer(Modifier.height(4.dp))
                            Text(
                                itx.line2!!,
                                color = Color.White.copy(alpha = 0.85f),
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }

                if (idx != items.lastIndex) {
                    Divider(color = Color.White.copy(alpha = 0.10f))
                }
            }
        }
    }
}

@Composable
private fun ScheduleTypeBadge(type: String) {
    val t = type.trim().uppercase()
    val (bg, fg, label) = when (t) {
        "REGULAR" -> Triple(Color.White.copy(alpha = 0.18f), Color.White, "REGULAR")
        "SHIFT" -> Triple(Color(0xFF1E88E5).copy(alpha = 0.35f), Color.White, "SHIFT")
        "ON_CALL", "ONCALL" -> Triple(Color(0xFFFB8C00).copy(alpha = 0.35f), Color.White, "ON_CALL")
        "SPECIAL" -> Triple(Color(0xFF8E24AA).copy(alpha = 0.35f), Color.White, "SPECIAL")
        else -> Triple(Color.White.copy(alpha = 0.18f), Color.White, t.take(6))
    }

    Surface(
        shape = RoundedCornerShape(999.dp),
        color = bg
    ) {
        Text(
            text = label,
            color = fg,
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(horizontal = 8.dp, vertical = 3.dp)
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DutyDetailSheet(
    item: DashboardDutyUi,
    onDismiss: () -> Unit
) {
    val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = sheetState,
        dragHandle = { BottomSheetDefaults.DragHandle() }
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 18.dp)
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = item.title?.takeIf { it.isNotBlank() } ?: "Jadwal Dinas",
                    style = MaterialTheme.typography.titleLarge,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f)
                )
                Spacer(Modifier.width(10.dp))
                ScheduleTypeBadge(type = item.scheduleType)
            }

            Spacer(Modifier.height(10.dp))

            Text(item.line1, fontWeight = FontWeight.SemiBold)
            if (!item.line2.isNullOrBlank()) {
                Spacer(Modifier.height(4.dp))
                Text(item.line2!!, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }

            if (!item.note.isNullOrBlank()) {
                Spacer(Modifier.height(12.dp))
                Text("Catatan", fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(6.dp))
                Text(item.note!!)
            }

            Spacer(Modifier.height(16.dp))
            Button(
                onClick = onDismiss,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp)
            ) { Text("Tutup") }
        }
    }
}
