package id.resta_pontianak.absensiapp.ui.screens.attendance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ErrorOutline
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.ui.helper.localizeBackendMessage
import id.resta_pontianak.absensiapp.ui.helper.localizeCheckInMessage

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AttendanceErrorRoute(
    message: String,
    onRetry: () -> Unit,
    onToDashboard: () -> Unit
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Gagal Absensi", color = Color.White) },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Color(0xFF0B2A5A))
            )
        }
    ) { padding ->
        Box(
            Modifier.fillMaxSize().padding(padding).padding(16.dp),
            contentAlignment = Alignment.Center
        ) {
            Card(shape = RoundedCornerShape(16.dp)) {
                Column(Modifier.padding(16.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Icon(Icons.Default.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                        Spacer(Modifier.width(10.dp))
                        Text("Absensi gagal", style = MaterialTheme.typography.titleLarge)
                    }
                    Spacer(Modifier.height(10.dp))
                    //val displayMsg = localizeCheckInMessage(message)

                    Text(message)

                    Spacer(Modifier.height(16.dp))
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Button(
                            onClick = onRetry,
                            modifier = Modifier.weight(1f),
                            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF22C55E))
                        ) { Text("Ulangi") }

                        OutlinedButton(
                            onClick = onToDashboard,
                            modifier = Modifier.weight(1f)
                        ) { Text("Dashboard") }
                    }
                }
            }
        }
    }

}