use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct TimezoneData {
    pub timezone: String,
    pub current_year: i32,
}

#[derive(Debug, Serialize)]
pub struct TimezoneResp {
    pub status: &'static str,
    pub data: TimezoneData,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTimezoneReq {
    pub timezone: String,
}
