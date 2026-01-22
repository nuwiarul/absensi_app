package id.resta_pontianak.absensiapp.ui.screens.tukin

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.YearMonth
import java.util.Locale

private val MONTH_NAMES_ID = listOf(
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MonthYearSelector(
    selectedMonth: String, // YYYY-MM
    onSelected: (String) -> Unit
) {
    val ym = runCatching { YearMonth.parse(selectedMonth) }
        .getOrElse { YearMonth.now() }

    val currentYear = YearMonth.now().year
    val years = remember(currentYear) { (currentYear - 2..currentYear + 1).toList() }

    var monthExpanded by remember { mutableStateOf(false) }
    var yearExpanded by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Month
        ExposedDropdownMenuBox(
            expanded = monthExpanded,
            onExpandedChange = { monthExpanded = !monthExpanded },
            modifier = Modifier.weight(1f)
        ) {
            val monthLabel = MONTH_NAMES_ID.getOrNull(ym.monthValue - 1) ?: ym.monthValue.toString()
            OutlinedTextField(
                modifier = Modifier.menuAnchor().fillMaxWidth(),
                readOnly = true,
                value = monthLabel,
                onValueChange = {},
                label = { androidx.compose.material3.Text("Bulan") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = monthExpanded) },
                colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
            )
            DropdownMenu(
                expanded = monthExpanded,
                onDismissRequest = { monthExpanded = false }
            ) {
                MONTH_NAMES_ID.forEachIndexed { idx, name ->
                    DropdownMenuItem(
                        text = { androidx.compose.material3.Text(name) },
                        onClick = {
                            val newYm = YearMonth.of(ym.year, idx + 1)
                            onSelected(newYm.toString())
                            monthExpanded = false
                        }
                    )
                }
            }
        }

        // Year
        ExposedDropdownMenuBox(
            expanded = yearExpanded,
            onExpandedChange = { yearExpanded = !yearExpanded },
            modifier = Modifier.weight(1f)
        ) {
            OutlinedTextField(
                modifier = Modifier.menuAnchor().fillMaxWidth(),
                readOnly = true,
                value = ym.year.toString(),
                onValueChange = {},
                label = { androidx.compose.material3.Text("Tahun") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = yearExpanded) },
                colors = ExposedDropdownMenuDefaults.outlinedTextFieldColors()
            )
            DropdownMenu(
                expanded = yearExpanded,
                onDismissRequest = { yearExpanded = false }
            ) {
                years.forEach { y ->
                    DropdownMenuItem(
                        text = { androidx.compose.material3.Text(y.toString()) },
                        onClick = {
                            val newYm = YearMonth.of(y, ym.monthValue)
                            onSelected(newYm.toString())
                            yearExpanded = false
                        }
                    )
                }
            }
        }
    }
}
