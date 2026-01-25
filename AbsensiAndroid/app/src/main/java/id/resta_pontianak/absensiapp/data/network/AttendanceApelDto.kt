package id.resta_pontianak.absensiapp.data.network

import com.google.gson.annotations.SerializedName

/**
 * Response item dari endpoint backend:
 * GET /attendance/apel/history?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
data class AttendanceApelDto(
    @SerializedName("work_date") val workDate: String, // yyyy-MM-dd
    @SerializedName("occurred_at") val occurredAt: String, // RFC3339 / ISO string
    val kind: String, // e.g. PAGI / MALAM
    @SerializedName("source_event") val sourceEvent: String? = null
)
