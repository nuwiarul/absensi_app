use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::constants::{AttendanceEventType, AttendanceLeaveType};
use crate::database::attendance::{AddAttendanceEvent, AttendanceEventRepo};
use crate::database::attendance_session::AttendanceSessionRepo;
use crate::database::user::UserRepo;
use crate::dtos::attendance::{AttendanceRekapDto, AttendanceRekapDtoResp};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use axum::extract::{Path};
use axum::response::IntoResponse;
use axum::routing::{delete, put};
use axum::{Extension, Json, Router};
use chrono::{DateTime, NaiveDate, Utc};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;
use crate::dtos::attendance_admin::AttendanceAdminResp;

#[derive(Debug, Deserialize, Validate)]
pub struct UpsertAttendanceAdminReq {
    /// RFC3339 with offset (recommended) or UTC timestamp.
    pub check_in_at: Option<DateTime<Utc>>,
    pub check_out_at: Option<DateTime<Utc>>,

    pub check_in_geofence_id: Option<Uuid>,
    pub check_out_geofence_id: Option<Uuid>,
    pub check_in_distance_to_fence_m: Option<f64>,
    pub check_out_distance_to_fence_m: Option<f64>,

    pub check_in_leave_type: Option<AttendanceLeaveType>,
    pub check_in_leave_notes: Option<String>,
    pub check_out_leave_type: Option<AttendanceLeaveType>,
    pub check_out_leave_notes: Option<String>,

    pub device_id: Option<String>,
    pub device_model: Option<String>,
    pub client_version: Option<String>,

    #[validate(length(min = 3, message = "alasan wajib diisi (min 3 karakter)"))]
    pub manual_note: String,
}

pub fn attendance_admin_handler() -> Router {
    Router::new()
        .route("/{user_id}/{work_date}", put(upsert_admin))
        .route("/{user_id}/{work_date}", delete(delete_admin))
}

fn ensure_superadmin(user_claims: &AuthMiddleware) -> Result<(), HttpError> {
    if user_claims.user_claims.role != UserRole::Superadmin {
        return Err(HttpError::unauthorized("Hanya SUPERADMIN yang dapat mengubah absensi".to_string()));
    }
    Ok(())
}

pub async fn upsert_admin(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path((user_id, work_date)): Path<(Uuid, NaiveDate)>,
    Json(payload): Json<UpsertAttendanceAdminReq>,
) -> Result<impl IntoResponse, HttpError> {
    ensure_superadmin(&user_claims)?;

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    // VALIDASI: untuk edit/tambah absensi manual, check-in wajib diisi
    if payload.check_in_at.is_none() {
        return Err(HttpError::bad_request(
            "check_in_at wajib diisi untuk edit/tambah absensi".to_string(),
        ));
    }

    // VALIDASI tambahan: jika kedua waktu diisi, check-out tidak boleh lebih awal
    if let (Some(cin), Some(cout)) = (payload.check_in_at, payload.check_out_at) {
        if cout < cin {
            return Err(HttpError::bad_request(
                "check_out_at tidak boleh lebih awal dari check_in_at".to_string(),
            ));
        }
    }

    let user = app_state
        .db_client
        .find_user_by_id(user_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or(HttpError::bad_request("user tidak ditemukan".to_string()))?;

    // Upsert the daily session
    let session_id = app_state
        .db_client
        .upsert_attendance_session(user.satker_id, user_id, work_date)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Overwrite times + mark as manual correction
    app_state
        .db_client
        .admin_set_attendance_session(
            session_id,
            payload.check_in_at,
            payload.check_out_at,
            &payload.manual_note,
            user_claims.user_claims.user_id,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Replace CHECK_IN / CHECK_OUT events for this session
    app_state
        .db_client
        .delete_attendance_event_by_session_type(session_id, AttendanceEventType::CheckIn)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    app_state
        .db_client
        .delete_attendance_event_by_session_type(session_id, AttendanceEventType::CheckOut)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if let Some(ts) = payload.check_in_at {
        let add_row = AddAttendanceEvent {
            session_id,
            satker_id: user.satker_id,
            user_id,
            event_type: AttendanceEventType::CheckIn,
            now: ts,
            latitude: None,
            longitude: None,
            accuracy_meters: None,
            geofence_id: payload.check_in_geofence_id,
            distance_to_fence_m: payload.check_in_distance_to_fence_m,
            selfie_object_key: None,
            liveness_score: None,
            face_match_score: None,
            device_id: payload.device_id.clone(),
            client_version: payload.client_version.clone(),
            device_model: payload.device_model.clone(),
            android_version: None,
            app_build: None,
            server_challenge_id: None,
            attendance_leave_type: payload.check_in_leave_type.unwrap_or(AttendanceLeaveType::Normal),
            attendance_leave_notes: payload.check_in_leave_notes.clone(),
        };

        app_state
            .db_client
            .add_attendance_event(add_row)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
    }

    if let Some(ts) = payload.check_out_at {
        let add_row = AddAttendanceEvent {
            session_id,
            satker_id: user.satker_id,
            user_id,
            event_type: AttendanceEventType::CheckOut,
            now: ts,
            latitude: None,
            longitude: None,
            accuracy_meters: None,
            geofence_id: payload.check_out_geofence_id,
            distance_to_fence_m: payload.check_out_distance_to_fence_m,
            selfie_object_key: None,
            liveness_score: None,
            face_match_score: None,
            device_id: payload.device_id.clone(),
            client_version: payload.client_version.clone(),
            device_model: payload.device_model.clone(),
            android_version: None,
            app_build: None,
            server_challenge_id: None,
            attendance_leave_type: payload.check_out_leave_type.unwrap_or(AttendanceLeaveType::Normal),
            attendance_leave_notes: payload.check_out_leave_notes.clone(),
        };

        app_state
            .db_client
            .add_attendance_event(add_row)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
    }

    let row: Option<AttendanceRekapDto> = app_state
        .db_client
        .find_attendance_by_user_work_date(work_date, user_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let row = row.ok_or(HttpError::server_error("gagal memuat rekap setelah update".to_string()))?;

    Ok(Json(AttendanceRekapDtoResp {
        status: "200",
        data: row,
    }))
}

pub async fn delete_admin(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path((user_id, work_date)): Path<(Uuid, NaiveDate)>,
) -> Result<impl IntoResponse, HttpError> {
    ensure_superadmin(&user_claims)?;

    let affected = app_state
        .db_client
        .delete_attendance_session_by_user_date(user_id, work_date)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(AttendanceAdminResp {
        status: "200",
        data: affected,
    }))
}
