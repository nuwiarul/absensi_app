// file: data/network/TukinModels.kt
package id.resta_pontianak.absensiapp.data.network

data class TukinCalculationDto(
    val month: String,
    val satker_id: String,
    val satker_code: String,
    val satker_name: String,
    val user_id: String,
    val user_full_name: String,
    val user_nrp: String,

    val base_tukin: Long,
    val expected_units: Double,
    val earned_credit: Double,
    val attendance_ratio: Double,
    val final_tukin: Long,

    val breakdown: TukinBreakdownDto?,
    val updated_at: String?
)

data class TukinBreakdownDto(
    val absent_days: Int,
    val days: List<TukinDayDto>,
    val duty_absent: Int,
    val duty_present: Int,
    val missing_checkout_days: Int,
    val month: String,
    val present_days: Int,
    val total_late_minutes: Int
)

data class TukinDayDto(
    val check_in_at: String?,
    val check_out_at: String?,
    val duty_schedule_id: String?,
    val earned_credit: Double,
    val expected_unit: Double,
    val is_duty_schedule: Boolean,
    val late_minutes: Int?,
    val leave_credit: Double?,
    val leave_type: String?,
    val note: String?,
    val work_date: String
)
