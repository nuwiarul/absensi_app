use crate::constants::AttendanceLeaveType;
use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::{Validate, ValidationError};

#[derive(Debug, Deserialize, Clone, Validate)]
pub struct AttendanceReq {
    pub challenge_id: Uuid,

    pub latitude: f64,
    pub longitude: f64,
    pub accuracy_meters: Option<f64>,

    // dari mobile (hasil liveness + match)
    pub liveness_score: Option<f64>,
    pub face_match_score: Option<f64>,

    // selfie disimpan di object storage (minio/s3)
    pub selfie_object_key: Option<String>,

    pub device_id: Option<String>,
    pub client_version: Option<String>,

    pub device_model: Option<String>,
    pub android_version: Option<String>,
    pub app_build: Option<String>,

    pub is_mock: Option<bool>,
    pub provider: Option<String>,
    pub location_age_ms: Option<i64>,

    pub leave_type: Option<AttendanceLeaveType>, // atau enum
    pub leave_notes: Option<String>,

    /// Jika `true`, user meminta dicatat sebagai apel (laporan saja, tidak mempengaruhi tukin).
    /// Backend tetap memvalidasi eligibility (mis. harus di dalam geofence & masih dalam window apel).
    pub apel: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct AttendanceDto {
    pub session_id: Uuid,
    pub work_date: NaiveDate,
    pub check_in_at: Option<DateTime<Utc>>,
    pub check_out_at: Option<DateTime<Utc>>,
    pub geofence_id: Option<Uuid>,
    pub distance_to_fence_m: Option<f64>,
    pub geofence_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AttendanceResp {
    pub status: &'static str,
    pub data: AttendanceDto,
}

/// DTO ringkas untuk kebutuhan attendance card (mobile).
///
/// - `work_date` adalah tanggal kerja dari session yang relevan untuk card.
/// - Jika duty lintas hari sedang/akan berjalan, `is_duty=true` dan duty window terisi.
#[derive(Debug, Serialize, Clone)]
pub struct AttendanceSessionTodayDto {
    pub work_date: NaiveDate,
    pub check_in_at: Option<DateTime<Utc>>,
    pub check_out_at: Option<DateTime<Utc>>,

    pub is_duty: bool,
    pub duty_start_at: Option<DateTime<Utc>>,
    pub duty_end_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Clone)]
pub struct AttendanceSessionTodayResp {
    pub status: &'static str,
    pub data: AttendanceSessionTodayDto,
}

#[derive(Debug, Serialize, Default, sqlx::FromRow)]
pub struct AttendanceRekapDto {
    pub session_id: Uuid,
    pub work_date: NaiveDate,
    pub user_id: Uuid,
    pub full_name: String,
    pub nrp: String,
    pub satker_name: String,
    pub satker_code: String,
    pub check_in_at: Option<DateTime<Utc>>,
    pub check_out_at: Option<DateTime<Utc>>,
    pub check_in_geofence_id: Option<Uuid>,
    pub check_out_geofence_id: Option<Uuid>,
    pub check_in_distance_to_fence_m: Option<f64>,
    pub check_out_distance_to_fence_m: Option<f64>,
    pub check_in_geofence_name: Option<String>,
    pub check_out_geofence_name: Option<String>,
    pub check_in_latitude: Option<f64>,
    pub check_in_longitute: Option<f64>,
    pub check_out_latitude: Option<f64>,
    pub check_out_longitute: Option<f64>,
    pub check_in_selfie_object_key: Option<String>,
    pub check_out_selfie_object_key: Option<String>,
    pub check_in_accuracy_meters: Option<f64>,
    pub check_out_accuracy_meters: Option<f64>,
    pub check_in_attendance_leave_type: Option<AttendanceLeaveType>,
    pub check_out_attendance_leave_type: Option<AttendanceLeaveType>,
    pub check_in_attendance_leave_notes: Option<String>,
    pub check_out_attendance_leave_notes: Option<String>,
    pub check_in_device_id: Option<String>,
    pub check_out_device_id: Option<String>,
    pub check_in_device_model: Option<String>,
    pub check_out_device_model: Option<String>,
    pub check_in_device_name: Option<String>,
    pub check_out_device_name: Option<String>,

    // Manual correction (oleh SUPERADMIN)
    pub is_manual: Option<bool>,
    pub manual_note: Option<String>,
    pub manual_updated_at: Option<DateTime<Utc>>,
}

pub fn validate_attendance_query(req: &AttendanceRekapDtoQuery) -> Result<(), ValidationError> {
    if req.to < req.from {
        let mut error = ValidationError::new("invalid_range");
        error.message = Some("Tanggal end tidak boleh lebih awal dari tanggal start".into());
        return Err(error);
    }

    Ok(())
}

#[derive(Debug, Deserialize, Validate)]
#[validate(schema(function = "validate_attendance_query"))]
pub struct AttendanceRekapDtoQuery {
    pub from: NaiveDate,
    pub to: NaiveDate,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Serialize)]
pub struct AttendanceRekapDtoResp {
    pub status: &'static str,
    pub data: AttendanceRekapDto,
}

#[derive(Debug, Serialize)]
pub struct AttendanceRekapsDtoResp {
    pub status: &'static str,
    pub data: Vec<AttendanceRekapDto>,
}
