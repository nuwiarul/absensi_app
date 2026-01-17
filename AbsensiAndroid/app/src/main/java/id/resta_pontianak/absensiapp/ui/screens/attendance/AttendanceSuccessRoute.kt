package id.resta_pontianak.absensiapp.ui.screens.attendance

import android.os.Build
import androidx.annotation.RequiresApi
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.data.network.AttendanceSessionData
import id.resta_pontianak.absensiapp.ui.screens.dashboard.AttendanceAction
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import kotlin.math.roundToInt

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceSuccessRoute(
    action: AttendanceAction,
    result: AttendanceSessionData?,
    onToDashboard: () -> Unit,
    onBackToDashboard: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Berhasil", color = Color.White) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0B2A5A))
            )
        }
    ) { padding ->
        Box(
            Modifier.fillMaxSize().padding(padding).padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            if (result == null) {
                Card(shape = RoundedCornerShape(16.dp)) {
                    Column(Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text("Data hasil tidak tersedia.")
                        Spacer(Modifier.height(12.dp))
                        Button(onClick = onToDashboard) { Text("Ke Dashboard") }
                    }
                }
                return@Box
            }

            val title = if (action == AttendanceAction.CheckIn) "Anda berhasil Check In" else "Anda berhasil Check Out"

            val isoTime = if (action == AttendanceAction.CheckIn) result.check_in_at else result.check_out_at
            val (dateText, timeText) = formatIsoToLocalDateTime(isoTime)

            val geoName = result.geofence_name ?: "-"
            val distance = result.distance_to_fence_m?.let { "${(it * 10).roundToInt() / 10.0} m" } ?: "-"

            Card(shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.CheckCircle, contentDescription = null, tint = Color(0xFF22C55E))
                        Spacer(Modifier.width(10.dp))
                        Text(title, style = MaterialTheme.typography.titleLarge)
                    }

                    Spacer(Modifier.height(14.dp))

                    InfoRow(label = "Tanggal", value = dateText)
                    InfoRow(label = "Jam", value = timeText)
                    InfoRow(label = "Geofence", value = geoName)
                    InfoRow(label = "Jarak dari geofence", value = distance)

                    Spacer(Modifier.height(16.dp))

                    Button(
                        onClick = onToDashboard,
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E))
                    ) { Text("Ke Dashboard") }

                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = onBackToDashboard,
                        modifier = Modifier.fillMaxWidth().height(48.dp)
                    ) { Text("Tutup") }
                }
            }
        }
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Color(0xFF6B7280))
        Text(value)
    }
    Spacer(Modifier.height(8.dp))
}

@RequiresApi(Build.VERSION_CODES.O)
private fun formatIsoToLocalDateTime(iso: String?): Pair<String, String> {
    if (iso.isNullOrBlank()) return "-" to "-"
    return try {
        val instant = Instant.parse(iso) // ISO Z
        val zone = ZoneId.systemDefault()

        val dateFmt = DateTimeFormatter.ofPattern("dd MMM yyyy").withZone(zone)
        val timeFmt = DateTimeFormatter.ofPattern("HH:mm:ss").withZone(zone)

        dateFmt.format(instant) to timeFmt.format(instant)
    } catch (_: Throwable) {
        "-" to "-"
    }
}
