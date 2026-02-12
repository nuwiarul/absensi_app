use crate::auth::rbac::UserRole;
use crate::constants::ScheduleType;
use crate::middleware::auth_middleware::UserClaims;
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::{Validate, ValidationError};

pub fn can_manage_schedule(user_claims: &UserClaims, satker_id: Uuid) -> bool {
    user_claims.role == UserRole::Superadmin
        || (user_claims.role == UserRole::SatkerAdmin && user_claims.satker_id == satker_id)
        || (user_claims.role == UserRole::SatkerHead && user_claims.satker_id == satker_id)
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateScheduleReq {
    pub user_id: Uuid,
    pub schedule_date: NaiveDate,
    pub schedule_type: ScheduleType,
    pub start_time: String,
    pub end_time: String,
    pub notes: Option<String>,
}

pub fn validate_schedule_query(req: &ScheduleQuery) -> Result<(), ValidationError> {
    if req.to < req.from {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("Tanggal end tidak boleh lebih awal dari tanggal start".into());
        return Err(error);
    }

    Ok(())
}

#[derive(Debug, Deserialize, Validate)]
#[validate(schema(function = "validate_schedule_query"))]
pub struct ScheduleQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct ScheduleDto {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub satker_code: String,
    pub satker_name: String,
    pub user_id: Uuid,
    pub user_full_name: String,
    pub user_nrp: String,
    pub user_phone: Option<String>,
    pub schedule_date: NaiveDate, // SQL: DATE

    pub schedule_type: ScheduleType,

    // Gunakan Option karena start_time dan end_time bisa NULL di DB
    pub start_time: Option<NaiveTime>, // SQL: TIME
    pub end_time: Option<NaiveTime>,   // SQL: TIME

    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct SchedulesResp {
    pub status: &'static str,
    pub data: Vec<ScheduleDto>,
}
