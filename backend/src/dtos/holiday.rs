use crate::constants::{HolidayKind, HolidayScope};
use chrono::NaiveDate;
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

#[derive(Debug, Deserialize)]
pub struct ListHolidaysQuery {
    /// Optional. If omitted, defaults to:
    /// - SUPERADMIN: all (NATIONAL + SATKER)
    /// - non-superadmin: SATKER (own satker)
    pub scope: Option<HolidayScope>,
    /// Required when scope=SATKER for SUPERADMIN. Ignored for NATIONAL.
    pub satker_id: Option<Uuid>,
    pub from: NaiveDate,
    pub to: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct ListHolidaysResp<T> {
    pub status: String,
    pub data: T,
}

#[derive(Debug, Deserialize)]
pub struct UpsertHolidayReq {
    pub scope: HolidayScope,
    pub satker_id: Option<Uuid>,
    pub holiday_date: NaiveDate,
    pub name: String,
    #[serde(default)]
    pub kind: Option<HolidayKind>,
    /// Only used when kind=HALF_DAY. Format: "HH:MM" or "HH:MM:SS".
    #[serde(default)]
    pub half_day_end: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpsertHolidayResp {
    pub status: String,
    pub data: String,
}

#[derive(Debug, Deserialize)]
pub struct DeleteHolidayQuery {
    pub scope: HolidayScope,
    pub satker_id: Option<Uuid>,
    pub holiday_date: NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct DeleteHolidayResp {
    pub status: String,
    pub data: String,
}
