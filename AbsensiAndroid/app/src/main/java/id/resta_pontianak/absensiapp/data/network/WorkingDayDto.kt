package id.resta_pontianak.absensiapp.data.network

import com.google.gson.annotations.SerializedName

/**
 * Response dari endpoint backend: GET /working-days
 *
 * Digunakan untuk menghitung:
 * - jenis hari (WORKDAY/HALF_DAY/HOLIDAY)
 * - jam expected (untuk hitung telat / pulang cepat)
 */
data class WorkingDayDto(
    @SerializedName("satker_id") val satkerId: String,
    @SerializedName("work_date") val workDate: String, // yyyy-MM-dd
    @SerializedName("day_type") val dayType: String,   // WORKDAY | HALF_DAY | HOLIDAY
    @SerializedName("expected_start") val expectedStart: String?, // HH:mm:ss
    @SerializedName("expected_end") val expectedEnd: String?,     // HH:mm:ss
    @SerializedName("note") val note: String?
)
