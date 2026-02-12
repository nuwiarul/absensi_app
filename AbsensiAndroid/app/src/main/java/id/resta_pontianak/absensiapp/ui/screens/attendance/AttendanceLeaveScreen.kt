package id.resta_pontianak.absensiapp.ui.screens.attendance

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.data.constant.LeaveType

import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MenuAnchorType // Penting untuk versi terbaru

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun AttendanceLeaveScreen(
    initialType: LeaveType? = LeaveType.DINAS_LUAR,   // ✅ default DINAS_LUAR
    initialNotes: String = "",
    onCancel: () -> Unit,
    onBack: () -> Unit,
    onContinue: (LeaveType, String) -> Unit
) {
    var expanded by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf(initialType ?: LeaveType.DINAS_LUAR) }
    var notes by remember { mutableStateOf(initialNotes) }

    val options = remember {
        listOf(
            LeaveType.DINAS_LUAR,
            /*LeaveType.WFA,
            LeaveType.WFH,*/
            LeaveType.IJIN,
            LeaveType.SAKIT
        )
    }

    fun labelOf(t: LeaveType): String = when (t) {
        LeaveType.DINAS_LUAR -> "Dinas Luar"
        /*LeaveType.WFA -> "WFA"
        LeaveType.WFH -> "WFH"*/
        LeaveType.IJIN -> "Ijin"
        LeaveType.SAKIT -> "Sakit"
        LeaveType.NORMAL -> "Normal"
    }

    Scaffold(
        topBar = {
            AttendanceTopBar(
                title = "Ijin Absensi",
                onBack = onBack
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier
                .padding(padding)
                .padding(16.dp)
        ) {

            // ✅ Combobox / Dropdown
            androidx.compose.material3.ExposedDropdownMenuBox(
                expanded = expanded,
                onExpandedChange = { expanded = !expanded }
            ) {
                androidx.compose.material3.OutlinedTextField(
                    value = labelOf(selected),
                    onValueChange = {},
                    readOnly = true,
                    label = { androidx.compose.material3.Text("Pilih jenis") },
                    trailingIcon = {
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded)
                    },
                    modifier = Modifier
                        .menuAnchor()
                        .fillMaxWidth()
                )

                ExposedDropdownMenu(
                    expanded = expanded,
                    onDismissRequest = { expanded = false }
                ) {
                    options.forEach { t ->
                        DropdownMenuItem(
                            text = { androidx.compose.material3.Text(labelOf(t)) },
                            onClick = {
                                selected = t
                                expanded = false
                            }
                        )
                    }
                }
            }

            Spacer(Modifier.height(12.dp))

            // Notes (opsional)
            androidx.compose.material3.OutlinedTextField(
                value = notes,
                onValueChange = { notes = it },
                label = { androidx.compose.material3.Text("Catatan (opsional)") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 4
            )

            Spacer(Modifier.height(16.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                androidx.compose.material3.OutlinedButton(
                    onClick = onCancel,
                    modifier = Modifier.weight(1f)
                ) { androidx.compose.material3.Text("Batal") }

                androidx.compose.material3.Button(
                    onClick = { onContinue(selected, notes) },
                    modifier = Modifier.weight(1f)
                ) { androidx.compose.material3.Text("Lanjut") }
            }
        }
    }
}
