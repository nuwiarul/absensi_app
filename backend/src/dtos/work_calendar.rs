use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct GenerateCalendarQuery {
    pub from: chrono::NaiveDate,
    pub to: chrono::NaiveDate,
}

#[derive(Debug, Serialize)]
pub struct GenerateCalendarResp {
    pub status: String,
    pub data: GenerateCalendarRespData,
}

#[derive(Debug, Serialize)]
pub struct GenerateCalendarRespData {
    pub days_generated: i64,
}
