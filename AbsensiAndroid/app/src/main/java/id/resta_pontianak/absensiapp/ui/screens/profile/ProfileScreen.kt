package id.resta_pontianak.absensiapp.ui.screens.profile

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.ui.helper.SetStatusBar
import id.resta_pontianak.absensiapp.ui.screens.dashboard.BlueHeader

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    state: ProfileViewModel.State,
    onBack: () -> Unit,
    snackbarHost: @Composable () -> Unit,

    // ✅ edit actions
    onOpenEdit: () -> Unit,
    onCloseEdit: () -> Unit,
    onEditFullName: (String) -> Unit,
    onEditPhone: (String) -> Unit,
    onSaveEdit: () -> Unit
) {

    SetStatusBar(BlueHeader, false)
    Scaffold(
        snackbarHost = snackbarHost,
        topBar = {
            TopAppBar(
                title = { Text("Informasi Profil") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = null)
                    }
                },
                actions = {
                    // ✅ tombol edit di kanan atas (sesuai request)
                    TextButton(onClick = onOpenEdit, enabled = !state.isLoading) {
                        Text("Edit Profil", color = Color.White)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = BlueHeader,
                    titleContentColor = Color.White,
                    navigationIconContentColor = Color.White,
                    actionIconContentColor = Color.White
                )
            )
        }
    ) { padding ->

        if (state.isLoading) {
            Box(
                Modifier
                    .padding(padding)
                    .fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .padding(padding)
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            InfoItem(label = "Nama Lengkap", value = state.fullName)
            InfoItem(label = "NRP", value = state.nrp)
            InfoItem(label = "Email", value = state.email)
            InfoItem(label = "Role", value = state.role)
            InfoItem(label = "Active", value = if (state.isActive) "Aktif" else "Nonaktif")
            InfoItem(label = "Satker", value = state.satkerName)
            InfoItem(label = "Pangkat", value = state.rank)
            InfoItem(label = "No. HP", value = state.phone)

            Spacer(Modifier.height(24.dp))
        }

        // ✅ Dialog edit profile
        if (state.showEditDialog) {
            AlertDialog(
                onDismissRequest = onCloseEdit,
                title = { Text("Edit Profil") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = state.editFullName,
                            onValueChange = onEditFullName,
                            label = { Text("Nama Lengkap *") },
                            singleLine = true,
                            enabled = !state.isSaving,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = state.editPhone,
                            onValueChange = onEditPhone,
                            label = { Text("No. HP") },
                            singleLine = true,
                            enabled = !state.isSaving,
                            modifier = Modifier.fillMaxWidth()
                        )

                        if (!state.editError.isNullOrBlank()) {
                            Text(
                                text = state.editError!!,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                },
                dismissButton = {
                    TextButton(onClick = onCloseEdit, enabled = !state.isSaving) {
                        Text("Batal")
                    }
                },
                confirmButton = {
                    TextButton(onClick = onSaveEdit, enabled = !state.isSaving) {
                        Text(if (state.isSaving) "Menyimpan..." else "Simpan")
                    }
                }
            )
        }
    }
}

@Composable
private fun InfoItem(label: String, value: String) {
    Column(Modifier.fillMaxWidth()) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(4.dp))
        Text(
            text = value,
            style = MaterialTheme.typography.bodyLarge,
            fontWeight = FontWeight.Medium
        )
    }
}
