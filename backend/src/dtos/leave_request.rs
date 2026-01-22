use super::validate_date;
use crate::constants::{LeaveStatus, LeaveType};
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::{Validate, ValidationError};
use crate::auth::rbac::UserRole;
use crate::dtos::satker::SatkerDto;
use crate::dtos::user::UserDto;
use crate::models::LeaveRequest;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct PendingLeaveDto {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub satker_code: String,
    pub satker_name: String,
    pub user_id: Uuid,
    pub requester_name: String,
    pub requester_nrp: String,
    pub tipe: LeaveType,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
    pub status: LeaveStatus,
    pub submitted_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct PendingLeaveResp {
    pub status: &'static str,
    pub data: Vec<PendingLeaveDto>,
}

pub fn validate_leave_dates(req: &CreateLeaveReq) -> Result<(), ValidationError> {
    if req.end_date < req.start_date {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("Tanggal selesai tidak boleh lebih awal dari tanggal mulai".into());
        return Err(error);
    }

    Ok(())
}

#[derive(Debug, Deserialize, Clone, Validate)]
#[validate(schema(function = "validate_leave_dates"))]
pub struct CreateLeaveReq {
    #[validate(length(min = 1, message = "tipe ijin di butuhkan"))]
    pub leave_type: String,
    #[validate(custom(function = "validate_date"))]
    pub start_date: NaiveDate,
    #[validate(custom(function = "validate_date"))]
    pub end_date: NaiveDate,
    pub reason: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DecisionLeaveReq {
    pub note: Option<String>,
}

pub fn validate_list_my_leaves_dates(req: &ListMyLeaveQuery) -> Result<(), ValidationError> {
    if req.to < req.from {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("Tanggal end tidak boleh lebih awal dari tanggal start".into());
        return Err(error);
    }

    Ok(())
}

#[derive(Debug, Deserialize, Clone, Validate)]
#[validate(schema(function = "validate_list_my_leaves_dates"))]
pub struct ListMyLeaveQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
    /// Optional filter: SUBMITTED / APPROVED / REJECTED / CANCELLED
    pub status: Option<String>,
}

pub fn validate_list_leave_admin_query(req: &ListLeaveAdminQuery) -> Result<(), ValidationError> {
    if req.to < req.from {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("Tanggal end tidak boleh lebih awal dari tanggal start".into());
        return Err(error);
    }

    Ok(())
}

/// Query untuk admin web (superadmin bisa filter by satker_id).
/// Untuk selain superadmin, satker_id akan diabaikan dan dipaksa ke satker user.
#[derive(Debug, Deserialize, Clone, Validate)]
#[validate(schema(function = "validate_list_leave_admin_query"))]
pub struct ListLeaveAdminQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub satker_id: Option<Uuid>,
}

/// Query untuk pending list (superadmin bisa filter by satker_id).
#[derive(Debug, Deserialize, Clone)]
pub struct ListPendingLeaveQuery {
    pub satker_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Clone)]
pub struct CreateLeaveDto {
    pub id: Uuid,
    pub satker: SatkerDto,
    pub user: UserDto,
    pub leave_type: LeaveType,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
    pub status: LeaveStatus,
    pub submitted_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LeaveRequestDto {
    pub id: Uuid,
    // Satker Details\
    pub satker_name: String,
    pub satker_id: Uuid,
    pub satker_code: String,

    // User (Pengaju) Details
    pub user_full_name: String,
    pub user_id: Uuid,
    pub user_nrp: String,
    pub role: UserRole, // Query: u.role AS "role: UserRole"
    pub user_phone: Option<String>,

    // Leave Details
    pub tipe: LeaveType, // Query: lr.tipe AS "tipe: LeaveType"
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
    pub status: LeaveStatus, // Query: lr.status AS "status: LeaveStatus"

    // Metadata & Approval
    pub submitted_at: Option<DateTime<Utc>>,
    pub decided_at: Option<DateTime<Utc>>,

    // Approver Details (Nullable karena LEFT JOIN)
    pub approver_full_name: Option<String>,
    pub approver_id: Option<Uuid>,
    pub approver_nrp: Option<String>,
    pub approver_role: Option<UserRole>, // Query: a.role AS "approver_role: UserRole"
    pub approver_phone: Option<String>, // Perbaikan: alias di SQL tadi tertulis user_phone

    pub decision_note: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,

}

#[derive(Debug, Serialize, Clone)]
pub struct LeaveRequestsResp {
    pub status: &'static str,
    pub data: Vec<LeaveRequestDto>,
}


#[derive(Debug, Serialize, Clone)]
pub struct CreateLeaveResp {
    pub status: &'static str,
    pub data: CreateLeaveDto,
}

#[derive(Debug, Deserialize, Clone, Validate)]
pub struct QuickApproveLeaveReq {
    pub user_id: Uuid,
    #[validate(length(min = 1, message = "tipe ijin di butuhkan"))]
    pub leave_type: String,
    pub work_date: NaiveDate,
    pub note: Option<String>,
}