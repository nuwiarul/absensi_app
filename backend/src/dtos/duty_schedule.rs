use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::{Validate, ValidationError};

use crate::auth::rbac::UserRole;
use crate::constants::ScheduleType;
use crate::middleware::auth_middleware::UserClaims;

pub fn can_manage_duty_schedules(user_claims: &UserClaims, satker_id: Uuid) -> bool {
    user_claims.role == UserRole::Superadmin
        || (user_claims.role == UserRole::SatkerAdmin && user_claims.satker_id == satker_id)
        || (user_claims.role == UserRole::SatkerHead && user_claims.satker_id == satker_id)
}

fn validate_duty_schedule_range(req: &CreateDutyScheduleReq) -> Result<(), ValidationError> {
    if req.end_at <= req.start_at {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("end_at harus lebih besar dari start_at".into());
        return Err(error);
    }
    Ok(())
}

#[derive(Debug, Deserialize, Validate)]
#[validate(schema(function = "validate_duty_schedule_range"))]
pub struct CreateDutyScheduleReq {
    pub user_id: Uuid,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    pub schedule_type: Option<ScheduleType>,
    pub title: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateDutyScheduleReq {
    pub start_at: Option<DateTime<Utc>>,
    pub end_at: Option<DateTime<Utc>>,
    pub schedule_type: Option<ScheduleType>,
    pub title: Option<String>,
    pub note: Option<String>,
}

pub fn validate_list_query(from: DateTime<Utc>, to: DateTime<Utc>) -> Result<(), ValidationError> {
    if to < from {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("Tanggal end tidak boleh lebih awal dari tanggal start".into());
        return Err(error);
    }
    Ok(())
}

#[derive(Debug, Deserialize, Validate)]
pub struct ListDutySchedulesQuery {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub satker_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct DutyScheduleDto {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub satker_code: String,
    pub satker_name: String,
    pub user_id: Uuid,
    pub user_full_name: String,
    pub user_nrp: String,
    pub user_phone: Option<String>,

    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,

    pub schedule_type: ScheduleType,
    pub title: Option<String>,
    pub note: Option<String>,

    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct DutySchedulesResp {
    pub status: &'static str,
    pub data: Vec<DutyScheduleDto>,
}
