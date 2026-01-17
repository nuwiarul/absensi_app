package id.resta_pontianak.absensiapp.data.network

import com.google.gson.annotations.SerializedName

data class AttendanceSessionDto(
    @SerializedName("session_id") val sessionId: String,
    @SerializedName("work_date") val workDate: String,
    @SerializedName("user_id") val userId: String,
    @SerializedName("full_name") val fullName: String,
    @SerializedName("nrp") val nrp: String,
    @SerializedName("satker_name") val satkerName: String,
    @SerializedName("satker_code") val satkerCode: String?,

    @SerializedName("check_in_at") val checkInAt: String?,
    @SerializedName("check_out_at") val checkOutAt: String?,

    @SerializedName("check_in_geofence_name") val checkInGeofenceName: String?,
    @SerializedName("check_out_geofence_name") val checkOutGeofenceName: String?,

    @SerializedName("check_in_distance_to_fence_m") val checkInDistanceM: Double?,
    @SerializedName("check_out_distance_to_fence_m") val checkOutDistanceM: Double?,

    @SerializedName("check_in_attendance_leave_type") val checkInLeaveType: String?,
    @SerializedName("check_out_attendance_leave_type") val checkOutLeaveType: String?,

    @SerializedName("check_in_attendance_leave_notes") val checkInLeaveNotes: String?,
    @SerializedName("check_out_attendance_leave_notes") val checkOutLeaveNotes: String?,

    @SerializedName("check_in_device_id") val checkInDeviceId: String?,
    @SerializedName("check_out_device_id") val checkOutDeviceId: String?,

    @SerializedName("check_in_device_name") val checkInDeviceName: String?,
    @SerializedName("check_out_device_name") val checkOutDeviceName: String?,

    @SerializedName("check_in_device_model") val checkInDeviceModel: String?,
    @SerializedName("check_out_device_model") val checkOutDeviceModel: String?,

    @SerializedName("check_in_latitude") val checkInLat: Double?,
    @SerializedName("check_in_longitute") val checkInLon: Double?,   // typo backend
    @SerializedName("check_out_latitude") val checkOutLat: Double?,
    @SerializedName("check_out_longitute") val checkOutLon: Double?, // typo backend

    @SerializedName("check_in_selfie_object_key") val checkInSelfieKey: String?,
    @SerializedName("check_out_selfie_object_key") val checkOutSelfieKey: String?
)
