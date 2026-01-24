package id.resta_pontianak.absensiapp.ui.screens.attendance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.ui.screens.dashboard.AttendanceAction

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ApelChoiceBottomSheet(
    action: AttendanceAction,
    onChooseApel: () -> Unit,
    onSkip: () -> Unit,
    onDismiss: () -> Unit,
) {
    val title = if (action == AttendanceAction.CheckIn) "Absen Masuk" else "Absen Keluar"
    ModalBottomSheet(
        onDismissRequest = onDismiss
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            Text(
                text = "Ambil Apel?",
                style = MaterialTheme.typography.titleLarge
            )
            Text(
                text = "Kamu berada di area kantor. Kamu bisa memilih ${title.lowercase()} + apel, atau absen saja.",
                style = MaterialTheme.typography.bodyMedium
            )

            Spacer(Modifier.height(8.dp))

            Button(
                onClick = onChooseApel,
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text(text = "Absen + Apel")
            }

            TextButton(
                onClick = onSkip,
                modifier = Modifier.fillMaxWidth().height(48.dp)
            ) {
                Text(text = "Absen saja")
            }

            Spacer(Modifier.height(12.dp))
        }
    }
}
