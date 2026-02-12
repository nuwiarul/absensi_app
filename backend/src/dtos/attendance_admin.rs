use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct AttendanceAdminResp {
    pub status: &'static str,
    pub data: u64,
}
