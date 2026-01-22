package id.resta_pontianak.absensiapp.data.network

data class DutyScheduleModels(
    val id: String,
    val satker_id: String? = null,
    val user_id: String? = null,
    val start_at: String,
    val end_at: String,
    val schedule_type: String,
    val title: String?,
    val note: String?,

)

data class DutyScheduleRequestDto(
    val id: String,
    val satker_id: String? = null,
    val user_id: String? = null,

    val satker_code: String? = null,
    val satker_name: String? = null,
    val user_full_name: String? = null,
    val user_nrp: String? = null,

    val start_at: String,
    val end_at: String,
    val schedule_type: String,
    val title: String?,
    val note: String?,
    val status: String,
    val reject_reason: String?
)

data class CreateDutyScheduleReq(
    val start_at: String,
    val end_at: String,
    val schedule_type: String,
    val title: String?,
    val note: String?
)

data class RejectDutyScheduleRequestReq(
    val reject_reason: String
)