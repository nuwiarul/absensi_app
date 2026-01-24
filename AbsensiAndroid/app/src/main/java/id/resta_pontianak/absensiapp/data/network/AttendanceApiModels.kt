package id.resta_pontianak.absensiapp.data.network

data class UploadSelfieData(
    val selfie_object_key: String
)

data class AttendanceChallengeData(
    val challenge_id: String,
    val nonce: String,
    val expires_at: String
)

data class AttendanceSessionData(
    val session_id: String,
    val work_date: String,
    val check_in_at: String?,
    val check_out_at: String?,
    val geofence_id: String?,
    val distance_to_fence_m: Double?,
    val geofence_name: String? // ✅ baru
)

data class AttendanceReq(
    val challenge_id: String,
    val latitude: Double,
    val longitude: Double,
    val accuracy_meters: Double?,
    val liveness_score: Double?,
    val face_match_score: Double?,
    val selfie_object_key: String?,
    val device_id: String?,
    val client_version: String?,
    val device_model: String?,      // ✅ baru
    val android_version: String?,   // ✅ baru
    val app_build: String?,

    val is_mock: Boolean?,
    val provider: String?,
    val location_age_ms: Long?,

    // ✅ leave
    val leave_type: String?,   // contoh: "NORMAL", "DINAS_LUAR"
    val leave_notes: String?,
    val apel: Boolean?
)