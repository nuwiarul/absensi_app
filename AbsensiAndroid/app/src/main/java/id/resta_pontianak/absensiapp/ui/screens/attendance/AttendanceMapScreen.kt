package id.resta_pontianak.absensiapp.ui.screens.attendance

import android.R
import android.text.Layout
import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.modifier.modifierLocalMapOf
import androidx.compose.ui.text.style.LineHeightStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import org.osmdroid.tileprovider.tilesource.TileSourceFactory
import org.osmdroid.util.GeoPoint
import org.osmdroid.views.MapView
import org.osmdroid.views.overlay.Marker
import org.osmdroid.views.overlay.Polygon

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceMapScreen(
    state: AttendanceMapUiState,
    distanceText: String,
    onRetry: () -> Unit,
    onRefreshLocation: () -> Unit,
    onCancel: () -> Unit,
    onContinue: () -> Unit,
    onBack: () -> Unit,
) {

    Scaffold(
        topBar = {
            AttendanceTopBar(
                title = "Absen Lokasi",
                onBack = onBack
            )
        }
    ) { padding ->

        Box(Modifier.fillMaxSize().background(Color(0xFFF5F7FB))) {
            // ===== MAP (OSM) =====
            AndroidView(
                modifier = Modifier.fillMaxSize(),
                factory = { ctx ->
                    MapView(ctx).apply {
                        setTileSource(TileSourceFactory.MAPNIK)
                        setMultiTouchControls(true)
                        controller.setZoom(16.0)
                        /*layoutParams = ViewGroup.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT
                        )*/
                    }
                },
                update = {
                        map ->
                    val fence = state.geofence
                    val userLat = state.userLat
                    val userLon = state.userLon

                    map.overlays.clear()

                    if (fence != null) {
                        val fencePoint = GeoPoint(fence.latitude, fence.longitude)
                        map.controller.setCenter(fencePoint)

                        val fenceMarker = Marker(map).apply {
                            position = fencePoint
                            title = fence.name
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                        }
                        map.overlays.add(fenceMarker)

                        val circle = buildCirclePolygon(
                            center = fencePoint,
                            radiusMeters = fence.radius_meters.toDouble()
                        ).apply {
                            fillPaint.color = android.graphics.Color.argb(50, 34, 197, 94) // hijau transparan
                            outlinePaint.color = android.graphics.Color.argb(180, 34, 197, 94)
                            outlinePaint.strokeWidth = 3f
                        }
                        map.overlays.add(circle)
                    }

                    if (userLat != null && userLon != null) {
                        val userPoint = GeoPoint(userLat, userLon)
                        val userMarker = Marker(map).apply {
                            position = userPoint
                            title = "Lokasi Anda"
                            setAnchor(Marker.ANCHOR_CENTER, Marker.ANCHOR_BOTTOM)
                            // Gunakan ContextCompat untuk mengambil instance baru dari icon default
                            val originalIcon = androidx.core.content.ContextCompat.getDrawable(
                                map.context,
                                org.osmdroid.library.R.drawable.marker_default
                            )

                            // .mutate() memastikan perubahan warna hanya untuk instance ini
                            val redIcon = originalIcon?.mutate()
                            redIcon?.setTint(android.graphics.Color.RED)

                            icon = redIcon
                        }
                        map.overlays.add(userMarker)
                    }

                    map.invalidate()
                }
            )

            // ===== TOP small status =====
            if (state.loading) {
                LinearProgressIndicator(modifier = Modifier.fillMaxWidth().align(Alignment.TopCenter))
            }

            if (state.error != null) {
                Card(
                    modifier = Modifier
                        .align(Alignment.TopCenter)
                        .padding(12.dp),
                    shape = RoundedCornerShape(14.dp)
                ) {
                    Row(
                        Modifier.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(state.error, color = MaterialTheme.colorScheme.error, modifier = Modifier.weight(1f))
                        TextButton(onClick = onRetry) { Text("Coba Lagi") }
                    }
                }
            }

            /*// ===== BOTTOM SHEET CARD (mirip screenshot) =====

            Card(
                modifier = Modifier
                    .align(Alignment.BottomCenter)
                    .fillMaxWidth(),
                shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp)
            ) {
                val inside = state.insideArea == true

                Column(
                    Modifier.padding(18.dp),
                    horizontalAlignment = Alignment.CenterHorizontally
                ) {
                    if (!inside) {
                        Icon(
                            Icons.Default.Warning,
                            contentDescription = null,
                            tint = Color(0xFFF59E0B),
                            modifier = Modifier.size(42.dp)
                        )
                        Spacer(Modifier.height(8.dp))
                        Text("Anda di luar area!", style = MaterialTheme.typography.titleLarge)
                        Spacer(Modifier.height(8.dp))

                        Text("Jarak Anda: $distanceText dari area absensi.")
                        Spacer(Modifier.height(4.dp))
                        Text("Ingin lanjutkan absen?", color = Color(0xFF6B7280))

                        Spacer(Modifier.height(14.dp))
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Button(
                                onClick = onCancel,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                            ) { Text("Batal") }

                            Button(
                                onClick = onContinue,
                                modifier = Modifier.weight(1f),
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E))
                            ) { Text("Lanjutkan") }
                        }
                    } else {
                        Text("Lokasi Absensi:", color = Color(0xFF6B7280))
                        Spacer(Modifier.height(4.dp))
                        Text(state.geofence?.name ?: "-", style = MaterialTheme.typography.titleMedium)
                        Spacer(Modifier.height(12.dp))
                        Button(
                            onClick = onContinue,
                            modifier = Modifier.fillMaxWidth().height(48.dp),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E))
                        ) { Text("Lanjutkan") }
                    }

                    Spacer(Modifier.height(10.dp))
                    TextButton(onClick = onRefreshLocation) { Text("Refresh lokasi") }
                }
            }*/

            // ===== BOTTOM SHEET =====
            BottomSheetAttendance(
                state = state,
                distanceText = distanceText,
                onCancel = onCancel,
                onContinue = onContinue,
                onRefreshLocation = onRefreshLocation,
                modifier = Modifier.align(Alignment.BottomCenter)
            )

        }

    }
}

private fun buildCirclePolygon(
    center: GeoPoint,
    radiusMeters: Double
) : Polygon {
    val circlePoints = Polygon.pointsAsCircle(center, radiusMeters)
    return Polygon().apply { points = circlePoints }
}