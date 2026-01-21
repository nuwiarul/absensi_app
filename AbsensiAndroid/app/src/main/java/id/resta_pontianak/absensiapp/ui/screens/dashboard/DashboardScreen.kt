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
import androidx.compose.foundation.layout.width
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.sp
import id.resta_pontianak.absensiapp.R



private val BlueHeader = Color(0xFF0B2A5A)
private val BlueCard = Color(0xFF123D8A)
private val BlueCard2 = Color(0xFF0F2F68)
private val Muted = Color(0xFF6B7280)

@Composable
fun DashboardScreen(
    fullName: String,
    nrp: String,
    satkerName: String,
    workDateText: String?,
    checkInTime: String,
    checkOutTime: String,
    checkInSubtitle: String,
    checkOutSubtitle: String,

    announcementTitle: String,
    announcementBody: String,
    announcementDate: String,
    scheduleBody: String,
    onClickMasuk: () -> Unit,
    onClickKeluar: () -> Unit,
    onClickTunkin: () -> Unit,
    onClickSchedule: () -> Unit,
    onClickIjin: () -> Unit,
    onClickRiwayatAbsen: () -> Unit,
    onLogoutClick: () -> Unit,
) {
    Column(Modifier.fillMaxSize().background(Color(0xFFF5F7FB))) {
        Header(fullName = fullName, nrp = nrp, satkerName=satkerName, onLogout = onLogoutClick)

        Spacer(Modifier.height(12.dp))

        if (!workDateText.isNullOrBlank()) {
            Text(
                text = workDateText,
                modifier = Modifier.padding(horizontal = 16.dp),
                color = Muted,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.height(8.dp))
        }


        Row(
            Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            AttendanceCard(
                title = "Masuk",
                time = checkInTime,
                subtitle = checkInSubtitle,
                onClick = onClickMasuk,
                modifier = Modifier.weight(1f)
            )
            AttendanceCard(
                title = "Keluar",
                time = checkOutTime,
                subtitle = checkOutSubtitle,
                onClick = onClickKeluar,
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(Modifier.height(12.dp))

        QuickMenu(
            onClickTunkin = onClickTunkin,
            onClickSchedule = onClickSchedule,
            onClickIjin = onClickIjin,
            onClickRiwayatAbsen = onClickRiwayatAbsen
        )

        Spacer(Modifier.height(14.dp))

        AnnouncementCard(
            title = announcementTitle,
            body = announcementBody,
            date = announcementDate
        )

        Spacer(Modifier.height(12.dp))

        ScheduleCard(body = scheduleBody)

    }
}

@Composable
private fun Header(fullName: String, nrp: String, satkerName: String, onLogout: () -> Unit) {
    val topInset = WindowInsets.statusBars.asPaddingValues().calculateTopPadding()

    Box(
        Modifier
            .fillMaxWidth()
            .background(BlueHeader)
            .padding(
                start = 0.dp,
                end = 16.dp,
                bottom = 16.dp,
                top = topInset + 6.dp
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


@Composable
private fun AttendanceCard(
    title: String,
    time: String,
    subtitle: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        onClick = onClick,
        modifier = modifier.height(140.dp),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(
            Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Text(title, fontWeight = FontWeight.SemiBold)
            Column {
                Text(time, style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(6.dp))
                Text(subtitle, color = Muted)
            }
        }
    }
}

@Composable
private fun QuickMenu(
    onClickTunkin: () -> Unit,
    onClickSchedule: () -> Unit,
    onClickIjin: () -> Unit,
    onClickRiwayatAbsen: () -> Unit
) {
    Row(
        Modifier
            .padding(horizontal = 16.dp)
            .fillMaxWidth()
            .background(BlueCard, RoundedCornerShape(18.dp))
            .padding(vertical = 14.dp),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        QuickItem("Tunkin", onClickTunkin)
        QuickItem("Jadwal Dinas", onClickSchedule)
        QuickItem("Ijin", onClickIjin)
        QuickItem("Riwayat Absensi", onClickRiwayatAbsen)
    }
}

@Composable
private fun QuickItem(label: String, onClick: () -> Unit) {
    TextButton(onClick = onClick) {
        Text(label, color = Color.White, fontWeight = FontWeight.SemiBold)
    }
}

@Composable
private fun AnnouncementCard(title: String, body: String, date: String) {
    Card(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Box(
            Modifier.background(BlueCard).padding(16.dp)
        ) {
            Column {
                Text(title, color = Color.White, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(10.dp))
                Text(body, color = Color.White.copy(alpha = 0.92f))
                Spacer(Modifier.height(10.dp))
                Text(date, color = Color.White.copy(alpha = 0.92f))
            }

            // ornament icon “besar samar” seperti screenshot
            Icon(
                Icons.Default.Notifications,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.18f),
                modifier = Modifier.align(Alignment.TopStart).size(44.dp)
            )
            Icon(
                Icons.Default.People,
                contentDescription = null,
                tint = Color.White.copy(alpha = 0.18f),
                modifier = Modifier.align(Alignment.TopEnd).size(44.dp)
            )
        }
    }
}

@Composable
private fun ScheduleCard(body: String) {
    Card(
        modifier = Modifier.padding(horizontal = 16.dp).fillMaxWidth(),
        shape = RoundedCornerShape(16.dp)
    ) {
        Box(
            Modifier.background(BlueCard2).padding(16.dp)
        ) {
            Column {
                Text("Jadwal Dinas", color = Color.White, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                Text(body, color = Color.White.copy(alpha = 0.9f))
            }
        }
    }
}