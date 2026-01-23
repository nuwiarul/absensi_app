package id.resta_pontianak.absensiapp.ui.screens.announcement

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import id.resta_pontianak.absensiapp.ui.helper.SetStatusBar
import id.resta_pontianak.absensiapp.ui.screens.dashboard.BlueHeader
import kotlinx.coroutines.flow.StateFlow

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AnnouncementsScreen(
    state: StateFlow<AnnouncementsViewModel.State>,
    onBack: () -> Unit,
    onRefresh: () -> Unit,
    onConsumeError: () -> Unit
) {
    val s by state.collectAsState()
    val snackbarHost = SnackbarHostState()

    LaunchedEffect(s.error) {
        s.error?.let {
            snackbarHost.showSnackbar(it)
            onConsumeError()
        }
    }

    SetStatusBar(BlueHeader, false)

    Scaffold(
        snackbarHost = { SnackbarHost(snackbarHost) },
        topBar = {
            TopAppBar(
                title = { Text("Pengumuman") },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, null) }
                },
                actions = {
                    IconButton(onClick = onRefresh, enabled = !s.isLoading) {
                        Icon(Icons.Filled.Refresh, contentDescription = "Refresh")
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
        when {
            s.isLoading && s.items.isEmpty() -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            }
            s.items.isEmpty() -> {
                Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                    Text("Belum ada pengumuman.")
                }
            }
            else -> {
                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(12.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    items(s.items, key = { it.id }) { a ->
                        AnnouncementCard(a)
                    }
                    if (s.isLoading) {
                        item {
                            Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                                CircularProgressIndicator()
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun AnnouncementCard(a: AnnouncementUi) {
    Card(Modifier.fillMaxWidth()) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                text = a.title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis
            )
            Text(
                text = a.dateLabel,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
            if (a.scopeLabel.isNotBlank()) {
                Text(
                    text = a.scopeLabel,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            Spacer(Modifier.height(2.dp))
            Text(
                text = a.body,
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 6,
                overflow = TextOverflow.Ellipsis
            )
        }
    }
}
