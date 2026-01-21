use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct AttendanceCountsQuery {
    /// yyyy-mm-dd
    pub date: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct SatkerAttendanceCountRow {
    pub satker_id: Uuid,
    pub satker_code: String,
    pub satker_name: String,
    pub checked_in_count: i64,
    pub total_users: i64,
    /// 0..100 (two decimals)
    pub present_pct: f64,
}

#[derive(Debug, Serialize)]
pub struct AttendanceCountsResp {
    pub status: String,
    pub data: Vec<SatkerAttendanceCountRow>,
}
