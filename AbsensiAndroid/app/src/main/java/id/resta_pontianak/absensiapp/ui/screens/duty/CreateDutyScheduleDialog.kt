package id.resta_pontianak.absensiapp.ui.screens.duty

import android.app.DatePickerDialog
import android.app.TimePickerDialog
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import java.time.Duration
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZonedDateTime
import java.time.format.DateTimeFormatter
import java.util.Locale

private val DATE_FMT = DateTimeFormatter.ofPattern("d MMM yyyy", Locale("id", "ID"))
private val TIME_FMT = DateTimeFormatter.ofPattern("HH:mm", Locale("id", "ID"))

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CreateDutyScheduleDialog(
    zoneId: ZoneId,
    isSubmitting: Boolean,
    submitError: String?,
    onClearSubmitError: () -> Unit,
    onDismiss: () -> Unit,
    onSubmit: (startLocal: ZonedDateTime, endLocal: ZonedDateTime, scheduleType: String, title: String?, note: String?) -> Unit
) {
    val ctx = LocalContext.current

    val now = ZonedDateTime.now(zoneId)
    var startDate by remember { mutableStateOf(now.toLocalDate()) }
    var startTime by remember { mutableStateOf(now.toLocalTime().withSecond(0).withNano(0)) }

    var endDate by remember { mutableStateOf(now.toLocalDate()) }
    var endTime by remember {
        mutableStateOf(
            now.toLocalTime().plusHours(1).withSecond(0).withNano(0)
        )
    }

    var scheduleType by remember { mutableStateOf("SPECIAL") }
    var title by remember { mutableStateOf("") }
    var note by remember { mutableStateOf("") }

    var error by remember { mutableStateOf<String?>(null) }

    val scheduleOptions = listOf("REGULAR", "SHIFT", "ON_CALL", "SPECIAL")
    var expanded by remember { mutableStateOf(false) }

    fun pickDate(
        initial: LocalDate,
        onPicked: (LocalDate) -> Unit
    ) {
        DatePickerDialog(
            ctx,
            { _, y, m, d -> onPicked(LocalDate.of(y, m + 1, d)) },
            initial.year,
            initial.monthValue - 1,
            initial.dayOfMonth
        ).show()
    }

    fun pickTime(
        initial: LocalTime,
        onPicked: (LocalTime) -> Unit
    ) {
        TimePickerDialog(
            ctx,
            { _, hh, mm -> onPicked(LocalTime.of(hh, mm)) },
            initial.hour,
            initial.minute,
            true
        ).show()
    }

    fun validate(): String? {
        val today = ZonedDateTime.now(zoneId).toLocalDate()
        if (startDate.isBefore(today)) return "Start tidak boleh tanggal kemarin"
        if (endDate.isBefore(startDate)) return "End tidak boleh sebelum start"

        val start = ZonedDateTime.of(startDate, startTime, zoneId)
        val end = ZonedDateTime.of(endDate, endTime, zoneId)

        if (!end.isAfter(start)) return "End harus setelah start"

        val dur = Duration.between(start, end)
        if (dur.toHours() > 24 || (dur.toHours() == 24L && dur.toMinutes() > 24L * 60L)) {
            return "Durasi tidak boleh lebih dari 24 jam"
        }
        return null
    }

    AlertDialog(
        onDismissRequest = {
            onDismiss
            onClearSubmitError()
        },
        title = { Text("Ajukan Jadwal Dinas") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {

                // schedule type (simple as text field + helper)
                ExposedDropdownMenuBox(
                    expanded = expanded,
                    onExpandedChange = { expanded = !expanded }
                ) {
                    OutlinedTextField(
                        value = scheduleType,
                        onValueChange = {},
                        readOnly = true,
                        label = { Text("Schedule Type") },
                        trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = expanded) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .menuAnchor()
                    )
                    ExposedDropdownMenu(
                        expanded = expanded,
                        onDismissRequest = { expanded = false }
                    ) {
                        scheduleOptions.forEach { opt ->
                            DropdownMenuItem(
                                text = { Text(opt) },
                                onClick = {
                                    scheduleType = opt
                                    expanded = false
                                }
                            )
                        }
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { pickDate(startDate) { startDate = it } }) {
                        Text("Start: ${startDate.format(DATE_FMT)}")
                    }
                    OutlinedButton(onClick = { pickTime(startTime) { startTime = it } }) {
                        Text(startTime.format(TIME_FMT))
                    }
                }

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { pickDate(endDate) { endDate = it } }) {
                        Text("End: ${endDate.format(DATE_FMT)}")
                    }
                    OutlinedButton(onClick = { pickTime(endTime) { endTime = it } }) {
                        Text(endTime.format(TIME_FMT))
                    }
                }

                OutlinedTextField(
                    value = title,
                    onValueChange = {
                        title = it
                        onClearSubmitError()
                    },
                    label = { Text("Judul (opsional)") },
                    modifier = Modifier.fillMaxWidth()
                )

                OutlinedTextField(
                    value = note,
                    onValueChange = {
                        note = it
                        onClearSubmitError()
                    },
                    label = { Text("Catatan (opsional)") },
                    modifier = Modifier.fillMaxWidth()
                )

                error?.let {
                    Spacer(Modifier.height(4.dp))
                    Text(it, color = MaterialTheme.colorScheme.error)
                }

                if (!submitError.isNullOrBlank()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        submitError,
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        },
        confirmButton = {
            Button(onClick = {
                val msg = validate()
                if (msg != null) {
                    error = msg
                    return@Button
                }
                onClearSubmitError()
                val start = ZonedDateTime.of(startDate, startTime, zoneId)
                val end = ZonedDateTime.of(endDate, endTime, zoneId)
                onSubmit(start, end, scheduleType, title, note)
            }) {
                Text("Submit")
            }
        },
        dismissButton = {
            OutlinedButton(onClick = {
                onClearSubmitError()
                onDismiss()
            }) {
                Text("Batal")
            }
        }
    )
}
