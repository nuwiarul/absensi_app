use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use validator::{Validate, ValidationError};

#[derive(Debug, Serialize, Clone, sqlx::FromRow)]
pub struct AttendanceApelDto {
    pub work_date: NaiveDate,
    pub occurred_at: DateTime<Utc>,
    pub kind: String,
    pub source_event: String,
}

fn validate_range(req: &AttendanceApelHistoryQuery) -> Result<(), ValidationError> {
    if req.to < req.from {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("Tanggal end tidak boleh lebih awal dari tanggal start".into());
        return Err(error);
    }
    Ok(())
}

#[derive(Debug, Deserialize, Validate)]
#[validate(schema(function = "validate_range"))]
pub struct AttendanceApelHistoryQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct AttendanceApelHistoryResp {
    pub status: &'static str,
    pub data: Vec<AttendanceApelDto>,
}
