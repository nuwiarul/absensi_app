use chrono::{Local, NaiveDate};
use serde::Serialize;
use validator::ValidationError;

pub mod user;
pub mod auth;
pub mod satker;
pub mod satker_head;
pub mod leave_request;
pub mod geofence;
pub mod attendance_challenge;
pub mod attendance_session;
pub mod attendance;
pub mod schedule;
pub mod upload;
pub mod holiday;
pub mod work_calendar;
pub mod work_pattern;
pub mod working_days;
pub mod settings;
pub mod rank;
pub mod attendance_admin;
pub mod duty_schedule;
pub mod tukin;
pub mod announcement;
pub mod dashboard;
pub mod duty_schedule_request;

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