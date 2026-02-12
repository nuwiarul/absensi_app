use chrono::{DateTime, NaiveDate, Utc};
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct UpdateAttendanceSession {
    pub id: Uuid,
    pub work_date: NaiveDate,
    pub check_in_at: Option<DateTime<Utc>>, // Option karena bisa null
    pub check_out_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, sqlx::FromRow, serde::Serialize, serde::Deserialize)]
pub struct RowAttendanceSession {
    pub check_in_at: Option<DateTime<Utc>>, // Option karena bisa null
    pub check_out_at: Option<DateTime<Utc>>,
}
