package id.resta_pontianak.absensiapp.data.network

import com.google.gson.annotations.SerializedName

/**
 * Response dari endpoint backend: GET /duty-schedules
 */
data class DutyScheduleDto(
    val id: String,

    @SerializedName("satker_id") val satkerId: String,
    @SerializedName("satker_code") val satkerCode: String,
    @SerializedName("satker_name") val satkerName: String,

    @SerializedName("user_id") val userId: String,
    @SerializedName("user_full_name") val userFullName: String,
    @SerializedName("user_nrp") val userNrp: String,
    @SerializedName("user_phone") val userPhone: String?,

    // ISO string (RFC3339)
    @SerializedName("start_at") val startAt: String,
    @SerializedName("end_at") val endAt: String,

    @SerializedName("schedule_type") val scheduleType: String,
    val title: String?,
    val note: String?
)
