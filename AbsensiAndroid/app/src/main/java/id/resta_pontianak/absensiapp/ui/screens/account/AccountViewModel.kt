package id.resta_pontianak.absensiapp.ui.screens.account

import android.content.ContentResolver
import android.content.Context
import android.net.Uri
import android.util.Log
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import coil.ImageLoader
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import id.resta_pontianak.absensiapp.data.local.TokenStore
import id.resta_pontianak.absensiapp.data.network.ApiErrorParser
import id.resta_pontianak.absensiapp.data.network.ApiService
import id.resta_pontianak.absensiapp.data.network.ProfileUrlProvider
import id.resta_pontianak.absensiapp.data.network.SelfieUrlProvider
import id.resta_pontianak.absensiapp.data.repo.DutyScheduleRepository
import id.resta_pontianak.absensiapp.data.repo.SettingsRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.File
import java.io.FileOutputStream
import java.time.LocalDate
import javax.inject.Inject

@HiltViewModel
class AccountViewModel @Inject constructor(
    // nanti kalau sudah sambung backend, inject repo di sini
    // private val accountRepo: AccountRepository,
    private val tokenStore: TokenStore,
    private val profileUrlProvider: ProfileUrlProvider,
    val imageLoader: ImageLoader,
    private val api: ApiService,
    private val dutyRepo: DutyScheduleRepository,
    private val settingsRepository: SettingsRepository,
    @ApplicationContext private val appContext: Context
) : ViewModel() {

    data class State(
        val fullName: String = "-",
        val nrp: String = "-",
        val profilePhotoKey: String? = null,

        val hadirHari: Int = 0,
        val tidakHadirHari: Int = 0,
        val tunkinNominal: String = "0",
        val pendingDutySubmittedCount: Int = 0,

        val isUploading: Boolean = false,
        val errorMessage: String? = null,
        val isChangingPassword: Boolean = false, // ✅ ADD
        val successMessage: String? = null,
        val changePasswordError: String? = null,
    )

    sealed interface Action {
        data object InformasiProfil : Action
        data object RiwayatPerizinan : Action
        data object RiwayatKehadiran : Action
        data object RiwayatTunkin : Action
        data object JadwalDinas : Action
        data object Logout : Action
    }

    private val _state = MutableStateFlow(State())
    val state: StateFlow<State> = _state.asStateFlow()

    /*init {
        viewModelScope.launch {
            val p = tokenStore.getProfile()
            if (p != null) {
                _state.value = _state.value.copy(
                    fullName = p.fullName,
                    nrp = p.nrp,
                    profilePhotoKey = p.profilePhotoKey
                )
            }
        }
    }*/

    init {
        viewModelScope.launch { loadLocalProfile() }
    }

    private suspend fun loadLocalProfile() {
        val p = tokenStore.getProfile() ?: return
        _state.value = _state.value.copy(
            fullName = p.fullName,
            nrp = p.nrp,
            profilePhotoKey = p.profilePhotoKey
        )
    }

    fun refreshBadges() {
        viewModelScope.launch { refreshPendingDutySubmittedCount() }
    }

    private suspend fun refreshPendingDutySubmittedCount() {
        try {
            //val from = LocalDate.now().minusYears(1).toString()
            //val to = LocalDate.now().plusYears(1).toString()
            val tz = settingsRepository.getTimezoneCached()
            val (from, to) = DateRangeUtil.currentToNextMonthRange(tz)
            val list = dutyRepo.listDutyScheduleRequests(
                status = "SUBMITTED",
                from = from,
                to = to
            )
            Log.d("DUTY", list.size.toString())
            _state.value = _state.value.copy(pendingDutySubmittedCount = list.size)
        } catch (_: Throwable) {
            // Kalau user tidak punya akses endpoint (mis. MEMBER), anggap 0.
            _state.value = _state.value.copy(pendingDutySubmittedCount = 0)
        }
    }

    fun consumeError() {
        _state.value = _state.value.copy(errorMessage = null)
    }

    fun consumeSuccess() { // ✅ ADD
        _state.value = _state.value.copy(successMessage = null)
    }

    fun consumeChangePasswordError() { // ✅ ADD
        _state.value = _state.value.copy(changePasswordError = null)
    }
    fun refreshLocal() { // ✅ ADD
        viewModelScope.launch { loadLocalProfile() }
    }


    fun onAction(action: Action) {
        when (action) {
            Action.InformasiProfil -> {}
            Action.RiwayatPerizinan -> {}
            Action.RiwayatKehadiran -> {}
            Action.RiwayatTunkin -> {}
            Action.JadwalDinas -> {}
            Action.Logout -> {}
        }
    }

    fun profileUrl(key: String): String = profileUrlProvider.build(key)

    fun uploadProfilePhotoFromUri(uri: Uri) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isUploading = true)

            try {
                val part = buildMultipartFromUri(
                    resolver = appContext.contentResolver,
                    uri = uri
                )

                val res = api.uploadProfilePhoto(part)

                val newKey = res.data
                if (res.status == "200" && !newKey.isNullOrBlank()) {
                    // ✅ simpan key
                    tokenStore.setProfilePhotoKey(newKey)

                    // ✅ langsung ganti avatar
                    _state.value = _state.value.copy(
                        profilePhotoKey = newKey,
                        isUploading = false
                    )
                } else {
                    // kalau status/data tidak sesuai
                    _state.value = _state.value.copy(
                        isUploading = false,
                        errorMessage = "gagal"
                    )
                }
            } catch (e: Throwable) {
                val msg = ApiErrorParser.parse(e) // ✅ akan jadi "gagal" kalau server balikin {"message":"gagal"}
                _state.value = _state.value.copy(
                    isUploading = false,
                    errorMessage = msg
                )
            }
        }
    }

    private fun buildMultipartFromUri(
        resolver: ContentResolver,
        uri: Uri
    ): MultipartBody.Part {
        // Copy content Uri -> temp file (stabil untuk retrofit)
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val ext = when {
            mime.contains("png") -> ".png"
            mime.contains("jpg") || mime.contains("jpeg") -> ".jpg"
            else -> ""
        }

        val tmp = File.createTempFile("profile_", ext, appContext.cacheDir)
        resolver.openInputStream(uri).use { input ->
            requireNotNull(input) { "Tidak bisa membaca file" }
            FileOutputStream(tmp).use { out -> input.copyTo(out) }
        }

        val rb = tmp.asRequestBody(mime.toMediaTypeOrNull())
        return MultipartBody.Part.createFormData(
            name = "file",
            filename = tmp.name,
            body = rb
        )
    }

    fun changeMyPassword(
        oldPassword: String,
        password: String,
        passwordConfirm: String,
        onSuccessCloseDialog: () -> Unit // dipanggil dari Route supaya dialog ditutup
    ) {
        viewModelScope.launch {
            _state.value = _state.value.copy(isChangingPassword = true)

            try {
                val res = api.changeMyPassword(
                    id.resta_pontianak.absensiapp.data.network.ChangeMyPasswordReq(
                        old_password = oldPassword,
                        password = password,
                        password_confirm = passwordConfirm
                    )
                )

                if (res.status == "200") {
                    _state.value = _state.value.copy(
                        isChangingPassword = false,
                        successMessage = "Sukses ganti password",
                        changePasswordError = null
                    )
                    onSuccessCloseDialog()
                } else {
                    _state.value = _state.value.copy(
                        isChangingPassword = false,
                        changePasswordError = res.message ?: "gagal"
                    )
                }
            } catch (e: Throwable) {
                val msg = ApiErrorParser.parse(e)
                _state.value = _state.value.copy(
                    isChangingPassword = false,
                    changePasswordError = msg
                )
            }
        }
    }

}
