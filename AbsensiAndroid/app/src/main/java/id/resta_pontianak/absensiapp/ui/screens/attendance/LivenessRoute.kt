package id.resta_pontianak.absensiapp.ui.screens.attendance

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import android.Manifest
import android.net.Uri
import android.widget.Toast
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavBackStackEntry
import androidx.navigation.NavHostController
import id.resta_pontianak.absensiapp.data.network.toUserMessage
import id.resta_pontianak.absensiapp.ui.navigation.Routes
import kotlinx.coroutines.launch
import java.net.URLEncoder

@Composable
fun LivenessRoute(
    navController: NavHostController,
    backStackEntry: NavBackStackEntry, // ✅ tambah
    onBack: () -> Unit,
    //onSuccess: (photoPath: String) -> Unit,
    onDone: () -> Unit,
) {
    val vm: LivenessViewModel = hiltViewModel()
    val parentEntry = remember(backStackEntry) {
        navController.getBackStackEntry(Routes.AttendanceGraph)
    }
    val shared: SharedAttendanceViewModel = hiltViewModel(parentEntry)
    val state by vm.state.collectAsState()

    val scope = rememberCoroutineScope()

    var hasCameraPermission by remember { mutableStateOf(false) }

    val context = LocalContext.current


    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        hasCameraPermission = granted
        if (!granted) vm.onCaptureError("Izin kamera ditolak")
    }

    LaunchedEffect(Unit) {
        permissionLauncher.launch(Manifest.permission.CAMERA)
    }

    LivenessScreen(
        state = state,
        hasCameraPermission = hasCameraPermission,
        onBack = onBack,
        onFace = { l, r -> vm.onFace(l, r) },
        onNoFace = { vm.onNoFace() },
        onCaptureError = { vm.onCaptureError(it) },
        onCaptured = { path ->
            //shared.setLivenessScore(0.92)
            shared.setLivenessScore(if (state.readyToCapture) 0.92 else 0.0)
            shared.setFaceMatchScore(if (state.readyToCapture) 0.90 else 0.0)
            scope.launch {
                try {
                    //android.util.Log.d("Liveness", "Submit OK session_id=${path}")
                    val result = shared.submit(path)
                    android.util.Log.d("Liveness", "Submit OK session_id=${result.session_id}")
                    //onSuccess(path)
                    //onDone();
                    navController.navigate("${Routes.AttendanceGraph}/${Routes.AttendanceSuccess}") {
                        launchSingleTop = true
                    }

                } catch (e: Throwable) {
                    //vm.onCaptureError(e.message ?: "Submit gagal")
                    if (e is AttendanceSubmitException) {
                        //val encoded = URLEncoder.encode(e.message ?: "Gagal absensi", "UTF-8")
                        val encoded = Uri.encode(e.message ?: "Gagal absensi")
                        navController.navigate("${Routes.AttendanceGraph}/${Routes.AttendanceError}/$encoded") {
                            launchSingleTop = true
                        }
                    } else {
                        Toast.makeText(context, e.toUserMessage(), Toast.LENGTH_LONG).show()
                    }
                }
            }

        }
    )
}