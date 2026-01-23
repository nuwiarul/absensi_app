package id.resta_pontianak.absensiapp.ui.screens.account

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.hilt.navigation.compose.hiltViewModel
import android.content.Context                // ✅ ADD
import android.net.Uri                        // ✅ ADD
import android.util.Log
import androidx.activity.compose.rememberLauncherForActivityResult // ✅ ADD
import androidx.activity.result.contract.ActivityResultContracts   // ✅ ADD
import androidx.compose.foundation.clickable   // ✅ ADD
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer // ✅ ADD
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height // ✅ ADD
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ListItem     // ✅ ADD
import androidx.compose.material3.ModalBottomSheet // ✅ ADD
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.SnackbarHost // ✅ ADD
import androidx.compose.material3.SnackbarHostState // ✅ ADD
import androidx.compose.material3.rememberModalBottomSheetState // ✅ ADD
import androidx.compose.runtime.LaunchedEffect // ✅ ADD
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext // ✅ ADD
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider      // ✅ ADD
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.ui.badges.LeaveBadgeViewModel
import kotlinx.coroutines.launch
import java.io.File                            // ✅ ADD


@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AccountRoute(
    tokenStore: TokenStore,
    onInformasiProfil: () -> Unit,
    onRiwayatPerizinan: () -> Unit,
    onRiwayatKehadiran: () -> Unit,
    onRiwayatTunkin: () -> Unit,
    onJadwalDinas: () -> Unit,
    onLogout: () -> Unit,
    vm: AccountViewModel = hiltViewModel()
) {

    val scope = rememberCoroutineScope()
    val s by vm.state.collectAsState()
    val badgeVm: LeaveBadgeViewModel = hiltViewModel()
    val badge by badgeVm.state.collectAsState()
    val ctx = LocalContext.current

    LaunchedEffect(Unit) {
        vm.refreshBadges()
    }

    var showLogoutDialog by remember { mutableStateOf(false) }
    var showPickSheet by remember { mutableStateOf(false) }

    val snackbarHostState = remember { SnackbarHostState() }

    var showChangePassword by remember { mutableStateOf(false) } // ✅ ADD

    var oldPass by remember { mutableStateOf("") }               // ✅ ADD
    var newPass by remember { mutableStateOf("") }               // ✅ ADD
    var newPass2 by remember { mutableStateOf("") }

    LaunchedEffect(s.errorMessage) {
        s.errorMessage?.let {
            snackbarHostState.showSnackbar(it)
            vm.consumeError()
        }
    }

    LaunchedEffect(s.successMessage) { // ✅ ADD
        s.successMessage?.let {
            snackbarHostState.showSnackbar(it)
            vm.consumeSuccess()
        }
    }

    LaunchedEffect(Unit) { vm.refreshLocal() }

    val pickGallery = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) vm.uploadProfilePhotoFromUri(uri)
    }

    var cameraUri by remember { mutableStateOf<Uri?>(null) }
    val takePicture = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.TakePicture()
    ) { ok ->
        if (ok) cameraUri?.let { vm.uploadProfilePhotoFromUri(it) }
    }

    fun createTempImageUri(context: Context): Uri {
        val dir = File(context.cacheDir, "camera").apply { mkdirs() }
        val file = File.createTempFile("profile_cam_", ".jpg", dir)
        return FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )
    }

    androidx.compose.material3.Scaffold(
        snackbarHost = { SnackbarHost(snackbarHostState) } // ✅ ADD
    ) { padding ->
        AccountScreen(
            fullName = s.fullName,
            nrp = s.nrp,
            hadirHari = s.hadirHari,
            tidakHadirHari = s.tidakHadirHari,
            tunkinNominal = s.tunkinNominal,
            tunkinUpdatedAtText = s.tunkinUpdatedAtText,
            isTunkinStale = s.isTunkinStale,
            isTunkinLoading = s.isTunkinLoading,
            onRefreshTunkin = { vm.onRefreshTukinManual() },

            profileUrl = vm::profileUrl,
            imageLoader = vm.imageLoader,
            profilePhotoKey = s.profilePhotoKey,

            onClickChangePhoto = { showPickSheet = true },
            isUploading = s.isUploading,
            leaveSubmittedBadgeCount = badge.submittedCount,

            onInformasiProfil = {
                vm.onAction(AccountViewModel.Action.InformasiProfil)
                onInformasiProfil()
            },
            onRiwayatPerizinan = {
                vm.onAction(AccountViewModel.Action.RiwayatPerizinan)
                onRiwayatPerizinan()
            },
            onRiwayatKehadiran = {
                vm.onAction(AccountViewModel.Action.RiwayatKehadiran)
                onRiwayatKehadiran()
            },
            onRiwayatTunkin = {
                vm.onAction(AccountViewModel.Action.RiwayatTunkin)
                onRiwayatTunkin()
            },
            pendingDutySubmittedCount = s.pendingDutySubmittedCount,
            onJadwalDinas = {
                vm.onAction(AccountViewModel.Action.JadwalDinas)
                onJadwalDinas()
            },
            onLogout = {
                vm.onAction(AccountViewModel.Action.Logout)
                //onLogout()
                showLogoutDialog = true
            },
            onChangePassword = { // ✅ ADD
                oldPass = ""
                newPass = ""
                newPass2 = ""
                showChangePassword = true
                vm.consumeChangePasswordError()
            },
        )

        if (showPickSheet) {
            ModalBottomSheet(
                onDismissRequest = { showPickSheet = false },
                sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
            ) {
                ListItem(
                    headlineContent = { Text("Ambil dari Kamera") },
                    supportingContent = { Text("Foto langsung dari kamera") },
                    modifier = Modifier.clickable(enabled = !s.isUploading) {
                        showPickSheet = false
                        val uri = createTempImageUri(ctx)
                        cameraUri = uri
                        takePicture.launch(uri)
                    }
                )
                ListItem(
                    headlineContent = { Text("Pilih dari Galeri") },
                    supportingContent = { Text("Upload foto dari galeri") },
                    modifier = Modifier.clickable(enabled = !s.isUploading) {
                        showPickSheet = false
                        pickGallery.launch("image/*")
                    }
                )
                Spacer(Modifier.height(16.dp))
            }
        }

        if (showLogoutDialog) {
            AlertDialog(
                onDismissRequest = { showLogoutDialog = false },
                title = { Text("Konfirmasi") },
                text = { Text("Anda yakin ingin logout?") },
                dismissButton = {
                    TextButton(onClick = { showLogoutDialog = false }) {
                        Text("Batal")
                    }
                },
                confirmButton = {
                    TextButton(
                        onClick = {
                            showLogoutDialog = false
                            scope.launch {
                                tokenStore.clear()
                                onLogout()
                            }

                        }
                    ) {
                        Text("Ya, Logout", color = MaterialTheme.colorScheme.error)

                    }
                }
            )
        }

        if (showChangePassword) { // ✅ ADD
            AlertDialog(
                onDismissRequest = {
                    if (!s.isChangingPassword) {
                        showChangePassword = false
                        vm.consumeChangePasswordError()
                    }
                },
                title = { Text("Change Password") },
                text = {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        OutlinedTextField(
                            value = oldPass,
                            onValueChange = {
                                oldPass = it
                                if (s.changePasswordError != null) vm.consumeChangePasswordError()
                            },
                            label = { Text("Password lama") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            enabled = !s.isChangingPassword,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = newPass,
                            onValueChange = {
                                newPass = it
                                if (s.changePasswordError != null) vm.consumeChangePasswordError()
                            },
                            label = { Text("Password baru") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            enabled = !s.isChangingPassword,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = newPass2,
                            onValueChange = {
                                newPass2 = it
                                if (s.changePasswordError != null) vm.consumeChangePasswordError()
                            },
                            label = { Text("Konfirmasi password baru") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            enabled = !s.isChangingPassword,
                            modifier = Modifier.fillMaxWidth()
                        )
                        if (!s.changePasswordError.isNullOrBlank()) { // ✅ ADD
                            Spacer(Modifier.height(6.dp))
                            Text(
                                text = s.changePasswordError!!,
                                color = MaterialTheme.colorScheme.error,
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                },
                dismissButton = {
                    TextButton(
                        onClick = { showChangePassword = false },
                        enabled = !s.isChangingPassword
                    ) { Text("Batal") }
                },
                confirmButton = {
                    TextButton(
                        enabled = !s.isChangingPassword,
                        onClick = {
                            vm.changeMyPassword(
                                oldPassword = oldPass,
                                password = newPass,
                                passwordConfirm = newPass2,
                                onSuccessCloseDialog = { showChangePassword = false }
                            )
                        }
                    ) {
                        if (s.isChangingPassword) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(18.dp),
                                strokeWidth = 2.dp
                            )
                            Spacer(Modifier.width(10.dp))
                            Text("Menyimpan...")
                        } else {
                            Text("Simpan")
                        }
                    }
                }
            )
        }


    }


}
