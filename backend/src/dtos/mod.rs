use chrono::{Local, NaiveDate};
use serde::Serialize;
use validator::ValidationError;

pub mod announcement;
pub mod attendance;
pub mod attendance_admin;
pub mod attendance_apel;
pub mod attendance_challenge;
pub mod attendance_session;
pub mod auth;
pub mod dashboard;
pub mod duty_schedule;
pub mod duty_schedule_request;
pub mod geofence;
pub mod holiday;
pub mod leave_request;
pub mod rank;
pub mod satker;
pub mod satker_head;
pub mod schedule;
pub mod settings;
pub mod tukin;
pub mod upload;
pub mod user;
pub mod work_calendar;
pub mod work_pattern;
pub mod working_days;

#[derive(Debug, Serialize)]
pub struct SuccessResponse {
    pub status: String,
    pub data: String,
}

pub fn validate_date(date: &NaiveDate) -> Result<(), ValidationError> {
    if *date < Local::now().date_naive() {
        let mut error = ValidationError::new("date");
        error.message = Some("Tanggal mulai tidak boleh di masa lalu".into());
        return Err(error);
    }
    Ok(())
}
