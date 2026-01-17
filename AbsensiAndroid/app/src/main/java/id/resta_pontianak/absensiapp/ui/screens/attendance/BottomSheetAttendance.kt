package id.resta_pontianak.absensiapp.ui.screens.attendance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp


@Composable
fun BottomSheetAttendance(
    state: AttendanceMapUiState,
    distanceText: String,
    onCancel: () -> Unit,
    onContinue: () -> Unit,
    onRefreshLocation: () -> Unit,
    modifier: Modifier = Modifier
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
    ) {
        Column(
            Modifier.padding(18.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            val inside = state.insideArea == true

            if (!inside) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = Color(0xFFF59E0B))
                Spacer(Modifier.height(8.dp))
                Text("Anda di luar area!", style = MaterialTheme.typography.titleLarge)
                Spacer(Modifier.height(8.dp))
                Text("Jarak Anda: $distanceText dari area absensi.")
                Spacer(Modifier.height(12.dp))

                val hasLocation = state.userLat != null && state.userLon != null
                val acc = state.accuracyM
                val accuracyOk = (acc ?: Double.MAX_VALUE) <= 50.0

                val statusText = when {
                    !hasLocation -> "Menunggu lokasi GPS…"
                    !accuracyOk -> "Akurasi GPS: ${acc?.toInt()} m (tunggu lebih stabil)"
                    else -> "Akurasi GPS: ${acc?.toInt()} m"
                }

                Text(statusText, color = Color(0xFF6B7280), style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(8.dp))

                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Button(
                        onClick = onCancel,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                    ) { Text("Batal") }
                    val canContinue = hasLocation && accuracyOk
                    Button(
                        onClick = onContinue,

                        enabled = canContinue,
                        modifier = Modifier.weight(1f),
                        colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E))
                    ) { Text("Lanjutkan") }
                }
            } else {
                Text("Lokasi Absensi", color = Color(0xFF6B7280))
                Spacer(Modifier.height(4.dp))
                Text(state.geofence?.name ?: "-", style = MaterialTheme.typography.titleMedium)
                Spacer(Modifier.height(12.dp))

                Button(
                    onClick = onContinue,

                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = Color(0xFF22C55E)// abu-abu saat disable
                    )
                ) { Text("Lanjutkan") }
            }

            Spacer(Modifier.height(8.dp))
            TextButton(onClick = onRefreshLocation) {
                Text("Refresh lokasi")
            }
        }
    }
}


