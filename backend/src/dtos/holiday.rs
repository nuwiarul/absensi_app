use crate::constants::{HolidayKind, HolidayScope};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct BulkHolidayReq {
    pub scope: HolidayScope,
    pub satker_id: Option<Uuid>,
    pub items: Vec<BulkHolidayItem>,
}

#[derive(Debug, Deserialize)]
pub struct BulkHolidayItem {
    pub holiday_date: chrono::NaiveDate,
    pub name: String,
    #[serde(default)]
    pub kind: Option<HolidayKind>,
    /// Only used when kind=HALF_DAY. Format: "HH:MM" or "HH:MM:SS".
    #[serde(default)]
    pub half_day_end: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct BulkHolidayResp {
    pub status: String,
    pub data: BulkHolidayRespData,
}

#[derive(Debug, Serialize)]
pub struct BulkHolidayRespData {
    pub affected_rows: i64,
}
