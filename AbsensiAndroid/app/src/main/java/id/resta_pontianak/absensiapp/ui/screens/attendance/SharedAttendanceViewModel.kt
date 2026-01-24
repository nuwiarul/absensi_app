package id.resta_pontianak.absensiapp.ui.screens.attendance

import android.view.View
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import id.resta_pontianak.absensiapp.data.local.DeviceIdProvider
import id.resta_pontianak.absensiapp.data.network.AttendanceReq
import id.resta_pontianak.absensiapp.data.network.AttendanceSessionData
import id.resta_pontianak.absensiapp.data.network.toUserMessage
import id.resta_pontianak.absensiapp.data.repo.AttendanceRepository
import id.resta_pontianak.absensiapp.ui.screens.dashboard.AttendanceAction
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import javax.inject.Inject
import id.resta_pontianak.absensiapp.BuildConfig
import id.resta_pontianak.absensiapp.data.constant.LeaveType


data class SharedAttendanceState(
    val action: AttendanceAction = AttendanceAction.CheckIn,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val accuracyMeters: Double? = null,
    val livenessScore: Double? = null,
    val faceMatchScore: Double? = null,

    val submitting: Boolean = false,
    val submitError: String? = null,
    val lastResult: AttendanceSessionData? = null,
    val triggerRefreshLocation: Boolean = false,

    val isMock: Boolean? = null,
    val provider: String? = null,
    val locationAgeMs: Long? = null,

    val leaveType: LeaveType = LeaveType.NORMAL,
    val leaveNotes: String? = null,

    // ✅ apel (opsional) - jika true akan dikirim ke backend
    val apel: Boolean? = null,
)

@HiltViewModel
class SharedAttendanceViewModel @Inject constructor(
    private val repo: AttendanceRepository,
    private val deviceIdProvider: DeviceIdProvider
) : ViewModel() {
    private val _state = MutableStateFlow(SharedAttendanceState())
    val state: StateFlow<SharedAttendanceState> = _state

    fun setAction(action: AttendanceAction) {
        _state.update { it.copy(action = action) }
    }

    fun setLocation(
        lat: Double,
        lon: Double,
        acc: Double?,
        isMock: Boolean?,
        provider: String?,
        ageMs: Long?
    ) {
        _state.update {
            it.copy(
                latitude = lat, longitude = lon, accuracyMeters = acc, isMock = isMock,
                provider = provider,
                locationAgeMs = ageMs
            )
        }
    }

    fun setLivenessScore(score: Double) {
        _state.update { it.copy(livenessScore = score) }
    }

    fun setFaceMatchScore(score: Double?) {
        _state.update { it.copy(faceMatchScore = score) }
    }

    fun setLeave(type: LeaveType, notes: String?) {
        _state.update { it.copy(leaveType = type, leaveNotes = notes) }
    }

    fun setApel(apel: Boolean?) {
        _state.update { it.copy(apel = apel) }
    }

    fun requestRefreshLocation() {
        _state.update { it.copy(triggerRefreshLocation = true) }
    }

    fun consumeRefreshLocationTrigger() {
        _state.update { it.copy(triggerRefreshLocation = false) }
    }

    suspend fun submit(photoPath: String): AttendanceSessionData {
        val s = _state.value
        val lat = s.latitude ?: error("Lokasi belum tersedia")
        val lon = s.longitude ?: error("Lokasi belum tersedia")

        _state.update { it.copy(submitting = true, submitError = null, lastResult = null) }

        if (s.isMock == true) {
            _state.update { it.copy(submitting = false) }
            throw AttendanceSubmitException("Mock location terdeteksi")
        }

        val selfieKey = try {
            repo.uploadSelfie(photoPath)
        } catch (e: Throwable) {
            _state.update { it.copy(submitting = false) }
            throw e
        }

        val challengeId = try {
            repo.getChallengeId()
        } catch (e: Throwable) {
            _state.update { it.copy(submitting = false) }
            throw e // -> toast
        }

        val deviceId = deviceIdProvider.getOrCreate()

        val req = AttendanceReq(
            challenge_id = challengeId,
            latitude = lat,
            longitude = lon,
            accuracy_meters = s.accuracyMeters,
            liveness_score = s.livenessScore,
            face_match_score = s.faceMatchScore,
            selfie_object_key = selfieKey,
            device_id = deviceId,
            client_version = BuildConfig.VERSION_NAME,
            device_model = deviceModel(),
            android_version = androidVersion(),
            app_build = appBuild(),
            is_mock = s.isMock,
            provider = s.provider,
            location_age_ms = s.locationAgeMs,
            // ✅ leave
            leave_type = s.leaveType.name,     // "NORMAL" / "DINAS_LUAR" / dst
            leave_notes = s.leaveNotes,

            // ✅ apel
            apel = s.apel
        )

        try {
            val result =
                if (s.action == AttendanceAction.CheckIn) repo.checkIn(req) else repo.checkOut(req)
            _state.update { it.copy(submitting = false, lastResult = result) }
            return result
        } catch (e: Throwable) {
            _state.update { it.copy(submitting = false) }
            throw AttendanceSubmitException(e.toUserMessage())
        }

        /*try {
            android.util.Log.d("AttendanceFlow", "1) Upload selfie start path=$photoPath")
            val selfieKey = repo.uploadSelfie(photoPath)
            android.util.Log.d("AttendanceFlow", "1) Upload selfie OK key=$selfieKey")

            android.util.Log.d("AttendanceFlow", "2) Challenge start")
            val challengeId = repo.getChallengeId()
            android.util.Log.d("AttendanceFlow", "2) Challenge OK id=$challengeId")

            val req = AttendanceReq(
                challenge_id = challengeId,
                latitude = lat,
                longitude = lon,
                accuracy_meters = s.accuracyMeters,
                liveness_score = s.livenessScore,      // dari liveness
                face_match_score = s.faceMatchScore,   // opsional
                selfie_object_key = selfieKey,
                device_id = "ANDROID-ABC",             // nanti bikin proper
                client_version = "1.0.0"
            )

            android.util.Log.d("AttendanceFlow", "3) Submit ${s.action} start")

            val result = if (s.action == AttendanceAction.CheckIn) {
                repo.checkIn(req)
            } else {
                repo.checkOut(req)
            }

            android.util.Log.d("AttendanceFlow", "3) Submit OK session_id=${result.session_id}")

            _state.update { it.copy(submitting = false, lastResult = result) }
            return result

        } catch (e: Throwable) {
            android.util.Log.e("AttendanceFlow", "submit FAILED", e)
            _state.update { it.copy(submitting = false, submitError = e.message ?: "Gagal submit") }
            throw e
        }*/

    }

    private fun deviceModel(): String {
        val manu = android.os.Build.MANUFACTURER ?: ""
        val model = android.os.Build.MODEL ?: ""
        return (manu.trim() + " " + model.trim()).trim().ifBlank { "UNKNOWN" }
    }

    private fun androidVersion(): String {
        return android.os.Build.VERSION.RELEASE ?: "UNKNOWN"
    }

    private fun appBuild(): String {
        // pakai BuildConfig (pastikan buildConfig = true)
        return "${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"
    }


}