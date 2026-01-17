use crate::auth::rbac::UserRole;
use crate::constants::{AttendanceEventType, AttendanceLeaveType, AttendanceStatus, LeaveStatus, LeaveType, ScheduleType};
use chrono::{DateTime, NaiveDate, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize, Serialize, sqlx::FromRow, Clone)]
pub struct User {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub nrp: String,
    pub full_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub role: UserRole,
    pub password_hash: String,
    pub is_active: bool,
    pub face_template_version: i32,
    pub face_template_hash: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Serialize, sqlx::FromRow, Clone)]
pub struct Satker {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub is_active: bool,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Deserialize, Serialize, sqlx::FromRow, Clone)]
pub struct SatkerHead {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub user_id: Uuid,
    pub active_from: NaiveDate,       // NOT NULL DATE
    pub active_to: Option<NaiveDate>, // Nullable DATE (untuk yang masih menjabat)
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct LeaveRequest {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub user_id: Uuid,
    pub tipe: LeaveType,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
    pub reason: Option<String>,
    pub status: LeaveStatus,
    pub submitted_at: Option<DateTime<Utc>>,
    pub decided_at: Option<DateTime<Utc>>,
    pub approver_id: Option<Uuid>,
    pub decision_note: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct Geofence {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_meters: i32,
    pub is_active: bool,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct AttendanceSession {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub user_id: Uuid,
    pub work_date: NaiveDate,
    pub check_in_at: Option<DateTime<Utc>>, // Option karena bisa null
    pub check_out_at: Option<DateTime<Utc>>,
    pub status: AttendanceStatus,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow, Clone)]
pub struct AttendanceEvent {
    pub id: Uuid,
    pub session_id: Option<Uuid>, // Nullable jika event terjadi sebelum session dibuat
    pub satker_id: Uuid,
    pub user_id: Uuid,

    pub event_type: AttendanceEventType,
    pub occurred_at: DateTime<Utc>,

    // Lokasi menggunakan f64 untuk presisi DOUBLE PRECISION
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub accuracy_meters: Option<f64>,

    pub geofence_id: Option<Uuid>,
    pub distance_to_fence_m: Option<f64>,

    // Media & Biometric
    pub selfie_object_key: Option<String>,
    pub liveness_score: Option<f64>,
    pub face_match_score: Option<f64>,

    // Metadata Perangkat
    pub device_id: Option<String>,
    pub client_version: Option<String>,

    pub server_challenge_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub device_model: Option<String>,
    pub android_version: Option<String>,
    pub app_build: Option<String>,
    pub attendance_leave_type: AttendanceLeaveType,
    pub attendance_leave_notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct DutySchedule {
    pub id: Uuid,
    pub satker_id: Uuid,
    pub user_id: Uuid,
    pub schedule_date: NaiveDate, // SQL: DATE

    pub schedule_type: ScheduleType,

    // Gunakan Option karena start_time dan end_time bisa NULL di DB
    pub start_time: Option<NaiveTime>, // SQL: TIME
    pub end_time: Option<NaiveTime>,   // SQL: TIME

    pub notes: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct UserDevice {
    pub id: Uuid,
    pub user_id: Uuid,
    pub device_id: Uuid,
    pub device_model: Option<String>,
    pub android_model: Option<String>,
    pub android_version: Option<String>,
    pub app_build: Option<String>,
    pub client_version: Option<String>,
}