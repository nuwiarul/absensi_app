use crate::constants::CalendarDayType;
use crate::models::SatkerCalendarDay;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct ListWorkingDaysQuery {
    pub satker_id: Uuid,
    pub from: chrono::NaiveDate,
    pub to: chrono::NaiveDate,
}

#[derive(Debug, Deserialize)]
pub struct UpsertWorkingDayReq {
    pub day_type: CalendarDayType,
    // format: HH:MM or HH:MM:SS
    pub expected_start: Option<String>,
    pub expected_end: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct WorkingDayDto {
    pub satker_id: Uuid,
    pub work_date: chrono::NaiveDate,
    pub day_type: CalendarDayType,
    pub expected_start: Option<String>,
    pub expected_end: Option<String>,
    pub note: Option<String>,
}

impl WorkingDayDto {
    pub fn from_row(r: &SatkerCalendarDay) -> Self {
        WorkingDayDto {
            satker_id: r.satker_id,
            work_date: r.work_date,
            day_type: r.day_type,
            expected_start: r.expected_start.map(|t| t.format("%H:%M:%S").to_string()),
            expected_end: r.expected_end.map(|t| t.format("%H:%M:%S").to_string()),
            note: r.note.clone(),
        }
    }

    pub fn from_rows(rows: &[SatkerCalendarDay]) -> Vec<Self> {
        rows.iter().map(Self::from_row).collect()
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct WorkingDaysResp {
    pub status: &'static str,
    pub data: Vec<WorkingDayDto>,
}

#[derive(Debug, Serialize, Clone)]
pub struct WorkingDayResp {
    pub status: &'static str,
    pub data: WorkingDayDto,
}
