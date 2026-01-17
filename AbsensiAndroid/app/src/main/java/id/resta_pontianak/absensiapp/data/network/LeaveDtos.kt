package id.resta_pontianak.absensiapp.data.network

import com.google.gson.annotations.SerializedName

// ===== CREATE =====
data class LeaveCreateReq(
    @SerializedName("leave_type") val leaveType: String,
    @SerializedName("start_date") val startDate: String, // yyyy-MM-dd
    @SerializedName("end_date") val endDate: String,     // yyyy-MM-dd
    @SerializedName("reason") val reason: String
)

// response create kamu bentuknya object langsung (tanpa status/data)
data class LeaveCreateResp(
    val id: String,
    @SerializedName("leave_type") val leaveType: String,
    @SerializedName("start_date") val startDate: String,
    @SerializedName("end_date") val endDate: String,
    val reason: String,
    val status: String,
    @SerializedName("submitted_at") val submittedAt: String?
)

// ===== LIST (mine/all) =====
data class LeaveListDto(
    val id: String,
    @SerializedName("satker_name") val satkerName: String,
    @SerializedName("satker_id") val satkerId: String,
    @SerializedName("satker_code") val satkerCode: String,

    @SerializedName("user_full_name") val userFullName: String,
    @SerializedName("user_id") val userId: String,
    @SerializedName("user_nrp") val userNrp: String,
    val role: String?,
    @SerializedName("user_phone") val userPhone: String?,

    @SerializedName("tipe") val tipe: String,
    @SerializedName("start_date") val startDate: String,
    @SerializedName("end_date") val endDate: String,
    val reason: String,
    val status: String,
    @SerializedName("submitted_at") val submittedAt: String?,
    @SerializedName("decided_at") val decidedAt: String?,

    @SerializedName("approver_full_name") val approverFullName: String?,
    @SerializedName("approver_id") val approverId: String?,
    @SerializedName("approver_nrp") val approverNrp: String?,
    @SerializedName("approver_role") val approverRole: String?,
    @SerializedName("approver_phone") val approverPhone: String?,

    @SerializedName("decision_note") val decisionNote: String?,
    @SerializedName("created_at") val createdAt: String?,
    @SerializedName("updated_at") val updatedAt: String?
)

// ===== PENDING =====
data class LeavePendingDto(
    val id: String,
    @SerializedName("satker_id") val satkerId: String,
    @SerializedName("satker_code") val satkerCode: String,
    @SerializedName("satker_name") val satkerName: String,

    @SerializedName("user_id") val userId: String,
    @SerializedName("requester_name") val requesterName: String,
    @SerializedName("requester_nrp") val requesterNrp: String,

    @SerializedName("tipe") val tipe: String,
    @SerializedName("start_date") val startDate: String,
    @SerializedName("end_date") val endDate: String,
    val reason: String,
    val status: String,
    @SerializedName("submitted_at") val submittedAt: String?,
    @SerializedName("created_at") val createdAt: String?
)

// ===== APPROVE / REJECT =====
data class LeaveDecisionReq(
    val note: String
)
