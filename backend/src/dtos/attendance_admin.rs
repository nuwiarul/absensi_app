use serde::Serialize;
use crate::dtos::attendance::AttendanceRekapDto;

#[derive(Debug, Serialize)]
pub struct AttendanceAdminResp {
    pub status: &'static str,
    pub data: u64,
}