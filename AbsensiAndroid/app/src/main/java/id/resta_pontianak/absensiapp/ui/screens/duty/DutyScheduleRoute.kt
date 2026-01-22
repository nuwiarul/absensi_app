package id.resta_pontianak.absensiapp.ui.screens.duty

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import kotlinx.coroutines.launch
import java.time.ZoneId

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DutyScheduleRoute(
    onBack: () -> Unit,
    vm: DutyScheduleViewModel = hiltViewModel()
) {
    var tab by remember { mutableIntStateOf(0) } // 0: jadwal, 1: pending
    val snackbarHost = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()

    var zoneId by remember { mutableStateOf<ZoneId?>(null) }
    LaunchedEffect(Unit) {
        zoneId = vm.zoneIdForUi()
        vm.initDefaultRangeIfNeeded() // ✅ pastikan range default siap
    }

    LaunchedEffect(tab) {
        if (tab == 0) vm.refreshSchedules() else vm.refreshRequests()
    }

    Scaffold(
        modifier = Modifier.fillMaxSize(),
        topBar = {
            TopAppBar(
                title = { Text("Jadwal Dinas") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.Default.ArrowBack, contentDescription = "Kembali")
                    }
                },
                actions = {
                    // ✅ Tombol tambah pindah ke kanan atas (hanya tab Pending)
                    if (tab == 1) {

                        Button(
                            onClick = { vm.updateShowCreateDialog(true) }
                        ) {
                            Text("Ajukan Jadwal Dinas")
                        }
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHost) },
        floatingActionButton = { /* ✅ HAPUS FAB */ }
    ) { pad ->
        Column(Modifier.padding(pad)) {
            TabRow(selectedTabIndex = tab) {
                Tab(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    text = { Text("Jadwal Dinas") }
                )
                Tab(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    text = { Text("Pending") }
                )
            }

            if (tab == 0) {
                DutyScheduleScreen(
                    vm = vm,
                    zoneId = zoneId
                )
            } else {
                PendingScheduleScreen(
                    vm = vm,
                    zoneId = zoneId,
                    snackbarHost = snackbarHost
                )
            }
        }
    }

    if (vm.showCreateDialog && zoneId != null) {
        CreateDutyScheduleDialog(
            zoneId = zoneId!!,
            onDismiss = { vm.updateShowCreateDialog(false) },
            onSubmit = { startLocal, endLocal, scheduleType, title, note ->
                vm.submitRequest(
                    startLocal = startLocal,
                    endLocal = endLocal,
                    scheduleType = scheduleType,
                    title = title,
                    note = note,
                    onSuccess = { msg ->
                        scope.launch { snackbarHost.showSnackbar(msg) }
                    },
                    onError = { msg ->
                        scope.launch { snackbarHost.showSnackbar(msg) }
                    }
                )
            }
        )
    }
}
