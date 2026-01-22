package id.resta_pontianak.absensiapp.ui.screens.duty

import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable

@Composable
fun DutyTypeChip(type: String) {
    val (bg, fg) = when (type.uppercase()) {
        "REGULAR" -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        "SHIFT" -> MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
        "ONCALL" -> MaterialTheme.colorScheme.tertiaryContainer to MaterialTheme.colorScheme.onTertiaryContainer
        "SPECIAL" -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }

    AssistChip(
        onClick = {},
        label = { Text(type.uppercase()) },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = bg,
            labelColor = fg
        )
    )
}

@Composable
fun StatusChip(status: String) {
    val (bg, fg) = when (status.uppercase()) {
        "SUBMITTED" -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        "APPROVED" -> MaterialTheme.colorScheme.secondaryContainer to MaterialTheme.colorScheme.onSecondaryContainer
        "REJECTED" -> MaterialTheme.colorScheme.errorContainer to MaterialTheme.colorScheme.onErrorContainer
        "CANCELED" -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
        else -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }

    AssistChip(
        onClick = {},
        label = { Text(status.uppercase()) },
        colors = AssistChipDefaults.assistChipColors(
            containerColor = bg,
            labelColor = fg
        )
    )
}
