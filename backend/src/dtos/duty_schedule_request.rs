use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::{Validate, ValidationError};

use crate::constants::ScheduleType;

fn validate_request_range(req: &CreateDutyScheduleRequestReq) -> Result<(), ValidationError> {
    if req.end_at <= req.start_at {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("end_at harus lebih besar dari start_at".into());
        return Err(error);
    }
    Ok(())
}

#[derive(Debug, Deserialize, Validate)]
#[validate(schema(function = "validate_request_range"))]
pub struct CreateDutyScheduleRequestReq {
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    pub schedule_type: ScheduleType,
    pub title: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListDutyScheduleRequestsQuery {
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub satker_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    /// default: SUBMITTED
    pub status: Option<String>,
}

#[derive(Debug, Deserialize, Validate)]
pub struct RejectDutyScheduleRequestReq {
    #[validate(length(min = 1, message = "catatan reject wajib diisi"))]
    pub reject_reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct DutyScheduleRequestDto {
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

    pub status: String,
    pub reject_reason: Option<String>,
    pub decided_by: Option<Uuid>,
    pub decided_at: Option<DateTime<Utc>>,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct DutyScheduleRequestsResp {
    pub status: &'static str,
    pub data: Vec<DutyScheduleRequestDto>,
}
