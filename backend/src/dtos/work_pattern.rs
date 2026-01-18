use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct UpsertWorkPatternReq {
    pub effective_from: NaiveDate,

    pub mon_work: bool,
    pub tue_work: bool,
    pub wed_work: bool,
    pub thu_work: bool,
    pub fri_work: bool,
    pub sat_work: bool,
    pub sun_work: bool,

    /// Format: "HH:MM" or "HH:MM:SS"
    pub work_start: String,
    /// Format: "HH:MM" or "HH:MM:SS"
    pub work_end: String,
    /// Format: "HH:MM" or "HH:MM:SS" (optional)
    pub half_day_end: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpsertWorkPatternResp {
    pub status: String,
    pub data: crate::models::SatkerWorkPattern,
}

#[derive(Debug, Serialize)]
pub struct WorkPatternsResp {
    pub status: String,
    pub data: Vec<crate::models::SatkerWorkPattern>,
}
