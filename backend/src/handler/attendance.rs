use crate::AppState;
use crate::constants::{AttendanceEventType, AttendanceLeaveType};
use crate::database::attendance::{AddAttendanceEvent, AttendanceEventRepo};
use crate::database::attendance_session::AttendanceSessionRepo;
use crate::database::geofence::GeofenceRepo;
use crate::dtos::attendance::{AttendanceDto, AttendanceRekapDto, AttendanceRekapDtoQuery, AttendanceRekapDtoResp, AttendanceRekapsDtoResp, AttendanceReq, AttendanceResp};
use crate::dtos::geofence::CreateGeofenceReq;
use crate::error::HttpError;
use crate::handler::attendance_challenge::{anti_teleport_check, validate_and_use_challenge};
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::utils::fungsi::haversine_m;
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;
use crate::database::user_device::UserDeviceRepo;
use chrono_tz::Asia::Jakarta;
use crate::auth::rbac::UserRole;
use crate::database::schedule::ScheduleRepo;
use crate::dtos::schedule::{can_manage_schedule, ScheduleQuery, SchedulesResp};
use crate::handler::attendance_admin::attendance_admin_handler;
use crate::utils::timezone_cache::get_timezone_cached;

pub fn attendance_handler() -> Router {
    Router::new()
        .route("/check-in", post(check_in))
        .route("/check-out", post(check_out))
        .route("/get", get(find_attendance))
        .route("/list", get(list_attendances))
        .nest("/admin", attendance_admin_handler())
}

async fn nearest_geofence(
    app_state: &Arc<AppState>,
    satker_id: Uuid,
    lat: f64,
    lon: f64,
) -> Result<Option<(Uuid, f64, i32)>, HttpError> {
    let geos = app_state
        .db_client
        .list_active_geofences_by_satker(satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if geos.is_empty() {
        return Ok(None);
    }

    let mut best: Option<(Uuid, f64, i32)> = Option::None;

    for g in geos {
        let d = haversine_m(lat, lon, g.latitude, g.longitude);
        match best {
            None => best = Some((g.id, d, g.radius_meters)),
            Some((_, best_d, _)) if d < best_d => best = Some((g.id, d, g.radius_meters)),
            _ => {}
        }
    }

    Ok(best)
}

pub async fn check_in(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<AttendanceReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    /*
    validate_and_use_challenge(&app_state, &user_claims.user_claims, payload.challenge_id)
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

     */

    let device_id = payload.device_id.clone()
        .ok_or(HttpError::bad_request("device_id wajib".to_string()))?;

    app_state.db_client
        .ensure_device_bound_first_user(
            user_claims.user_claims.user_id,
            &device_id,
            payload.device_model.clone(),
            payload.android_version.clone(),
            payload.app_build.clone(),
            payload.client_version.clone(),
        ).await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    // ✅ reject mock
    if payload.is_mock.unwrap_or(false) {
        return Err(HttpError::bad_request("mock location terdeteksi".to_string()));
    }

    // ✅ reject location too old
    /*if let Some(age) = payload.location_age_ms {
        if age > 10_000 {
            return Err(HttpError::bad_request("lokasi terlalu lama, silakan refresh lokasi".to_string()));
        }
    }*/

    // ✅ reject accuracy too poor
    if let Some(acc) = payload.accuracy_meters {
        if acc > 50.0 {
            return Err(HttpError::bad_request("akurasi lokasi terlalu rendah, silakan coba lagi".to_string()));
        }
    }

    validate_and_use_challenge(
        &app_state,
        &user_claims.user_claims,
        payload.challenge_id,
        &device_id, // ✅ bind device
    ).await?;

    anti_teleport_check(
        &app_state,
        user_claims.user_claims.user_id,
        &device_id,
        payload.latitude,
        payload.longitude,
    ).await?;

    let nearest = nearest_geofence(
        &app_state,
        user_claims.user_claims.satker_id,
        payload.latitude,
        payload.longitude,
    )
    .await
    .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let (geofence_id, distance_m, radius_m) = nearest.ok_or(HttpError::bad_request(
        "geofence aktif belum diset untuk satker ini".to_string(),
    ))?;

    /*if distance_m > radius_m as f64 {
        return Err(HttpError::bad_request(format!(
            "di luar geofence: jarak {:.1}m > radius {}m",
            distance_m, radius_m
        )));
    }*/

    let out_of_fence = distance_m > radius_m as f64;

    let mut leave_type = payload.leave_type.clone().unwrap_or(AttendanceLeaveType::Normal);
    let leave_notes = payload.leave_notes.clone();

    if out_of_fence {
        if matches!(leave_type, AttendanceLeaveType::Normal) {
            return Err(HttpError::bad_request(format!(
                "di luar geofence: jarak {:.1}m > radius {}m. Pilih jenis izin/dinas terlebih dahulu",
                distance_m, radius_m
            )));
        }
    } else {
        leave_type = AttendanceLeaveType::Normal;
    }

    let now = Utc::now();

    //let now_wib = now.with_timezone(&Jakarta);
    //let work_date = now_wib.date_naive();
    let tz = get_timezone_cached(&app_state).await?;
    let work_date = now.with_timezone(&tz).date_naive();

    let session_id = app_state
        .db_client
        .upsert_attendance_session(
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            work_date,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let attendance_event_row = app_state
        .db_client
        .find_attendance_event_by_session(session_id, AttendanceEventType::CheckIn)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if let Some(_) = attendance_event_row {

        let sess_check_in = app_state.db_client
            .find_attendance_session(session_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

        let session_hour = sess_check_in.check_in_at.unwrap();
        let iso = session_hour.to_rfc3339();

        return Err(HttpError::bad_request(format!("Anda sudah melakukan check in, pada hari ini {iso}")));
    }

    let updated = app_state
        .db_client
        .update_check_in_attendance_session(session_id, Some(now))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let fence_row = app_state
        .db_client
        .find_geofence(geofence_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let add_row = AddAttendanceEvent {
        session_id,
        satker_id: user_claims.user_claims.satker_id,
        user_id: user_claims.user_claims.user_id,
        event_type: AttendanceEventType::CheckIn,
        now,
        latitude: Some(payload.latitude),
        longitude: Some(payload.longitude),
        accuracy_meters: payload.accuracy_meters,
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        selfie_object_key: payload.selfie_object_key,
        liveness_score: payload.liveness_score,
        face_match_score: payload.face_match_score,
        device_id: payload.device_id,
        client_version: payload.client_version,
        server_challenge_id: Some(payload.challenge_id),
        device_model: payload.device_model,
        android_version: payload.android_version,
        app_build: payload.app_build,
        attendance_leave_type: leave_type,
        attendance_leave_notes: leave_notes,
    };

    app_state
        .db_client
        .add_attendance_event(add_row)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let attendance_dto = AttendanceDto {
        session_id: updated.id,
        work_date: updated.work_date,
        check_in_at: updated.check_in_at.map(|t| t.into()),
        check_out_at: updated.check_out_at.map(|t| t.into()),
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        geofence_name: Some(fence_row.unwrap().name),
    };

    let response = AttendanceResp {
        status: "200",
        data: attendance_dto,
    };

    Ok(Json(response))
}

pub async fn check_out(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<AttendanceReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;
    /*
    validate_and_use_challenge(&app_state, &user_claims.user_claims, payload.challenge_id)
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

     */

    let device_id = payload.device_id.clone()
        .ok_or(HttpError::bad_request("device_id wajib".to_string()))?;

    app_state.db_client
        .ensure_device_bound_first_user(
            user_claims.user_claims.user_id,
            &device_id,
            payload.device_model.clone(),
            payload.android_version.clone(),
            payload.app_build.clone(),
            payload.client_version.clone(),
        ).await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    // ✅ reject mock
    if payload.is_mock.unwrap_or(false) {
        return Err(HttpError::bad_request("mock location terdeteksi".to_string()));
    }

    // ✅ reject location too old
   /* if let Some(age) = payload.location_age_ms {
        if age > 10_000 {
            return Err(HttpError::bad_request("lokasi terlalu lama, silakan refresh lokasi".to_string()));
        }
    }*/

    // ✅ reject accuracy too poor
    if let Some(acc) = payload.accuracy_meters {
        if acc > 50.0 {
            return Err(HttpError::bad_request("akurasi lokasi terlalu rendah, silakan coba lagi".to_string()));
        }
    }

    validate_and_use_challenge(
        &app_state,
        &user_claims.user_claims,
        payload.challenge_id,
        &device_id, // ✅ bind device
    ).await?;

    anti_teleport_check(
        &app_state,
        user_claims.user_claims.user_id,
        &device_id,
        payload.latitude,
        payload.longitude,
    ).await?;

    let nearest = nearest_geofence(
        &app_state,
        user_claims.user_claims.satker_id,
        payload.latitude,
        payload.longitude,
    )
    .await
    .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let (geofence_id, distance_m, radius_m) = nearest.ok_or(HttpError::bad_request(
        "geofence aktif belum diset untuk satker ini".to_string(),
    ))?;

   /* if distance_m > radius_m as f64 {
        return Err(HttpError::bad_request(format!(
            "di luar geofence: jarak {:.1}m > radius {}m",
            distance_m, radius_m
        )));
    }*/

    let out_of_fence = distance_m > radius_m as f64;

    let mut leave_type = payload.leave_type.clone().unwrap_or(AttendanceLeaveType::Normal);
    let leave_notes = payload.leave_notes.clone();

    if out_of_fence {
        if matches!(leave_type, AttendanceLeaveType::Normal) {
            return Err(HttpError::bad_request(format!(
                "di luar geofence: jarak {:.1}m > radius {}m. Pilih jenis izin/dinas terlebih dahulu",
                distance_m, radius_m
            )));
        }
    } else {
        leave_type = AttendanceLeaveType::Normal;
    }

    let now = Utc::now();
    //let now_wib = now.with_timezone(&Jakarta);
    //let work_date = now_wib.date_naive();
    let tz = get_timezone_cached(&app_state).await?;
    let work_date = now.with_timezone(&tz).date_naive();

    let session_id = app_state
        .db_client
        .upsert_attendance_session(
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            work_date,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let sess = app_state
        .db_client
        .find_attendance_session(session_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if sess.check_in_at.is_none() {
        return Err(HttpError::bad_request("belum check-in".to_string()));
    }

    let attendance_event_row = app_state
        .db_client
        .find_attendance_event_by_session(session_id, AttendanceEventType::CheckOut)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if let Some(_) = attendance_event_row {

        let sess_check_in = app_state.db_client
            .find_attendance_session(session_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let session_hour = sess_check_in.check_out_at.unwrap();
        let iso = session_hour.to_rfc3339();

        return Err(HttpError::bad_request(format!("Anda sudah melakukan check out, pada hari ini {iso}")));
    }

    let updated = app_state
        .db_client
        .update_check_out_attendance_session(session_id, Some(now))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let fence_row = app_state
        .db_client
        .find_geofence(geofence_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let add_row = AddAttendanceEvent {
        session_id,
        satker_id: user_claims.user_claims.satker_id,
        user_id: user_claims.user_claims.user_id,
        event_type: AttendanceEventType::CheckOut,
        now,
        latitude: Some(payload.latitude),
        longitude: Some(payload.longitude),
        accuracy_meters: payload.accuracy_meters,
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        selfie_object_key: payload.selfie_object_key,
        liveness_score: payload.liveness_score,
        face_match_score: payload.face_match_score,
        device_id: payload.device_id,
        client_version: payload.client_version,
        server_challenge_id: Some(payload.challenge_id),
        device_model: payload.device_model,
        android_version: payload.android_version,
        app_build: payload.app_build,
        attendance_leave_type: leave_type,
        attendance_leave_notes: leave_notes,
    };

    app_state
        .db_client
        .add_attendance_event(add_row)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let attendance_dto = AttendanceDto {
        session_id: updated.id,
        work_date: updated.work_date,
        check_in_at: updated.check_in_at.map(|t| t.into()),
        check_out_at: updated.check_out_at.map(|t| t.into()),
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        geofence_name: Some(fence_row.unwrap().name),
    };

    let response = AttendanceResp {
        status: "200",
        data: attendance_dto,
    };

    Ok(Json(response))
}

pub async fn find_attendance(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {

    let now = Utc::now();
    let now_wib = now.with_timezone(&Jakarta);
    let work_date = now_wib.date_naive();


    let row = app_state
    .db_client
        .find_attendance_by_user_work_date(
            work_date,
            user_claims.user_claims.user_id,
        ).await
    .map_err(|e| HttpError::server_error(e.to_string()))?;

    let mut dto = AttendanceRekapDto::default();

    if let Some(row) = row {
        dto.session_id = row.session_id;
        dto.work_date = row.work_date;
        dto.user_id = row.user_id;
        dto.full_name = row.full_name;
        dto.nrp = row.nrp;
        dto.check_in_at = row.check_in_at.map(|t| t.into());
        dto.check_out_at = row.check_out_at.map(|t| t.into());
        dto.check_in_geofence_id = row.check_in_geofence_id.map(|t| t.into());
        dto.check_out_geofence_id = row.check_out_geofence_id.map(|t| t.into());
        dto.check_in_distance_to_fence_m = row.check_in_distance_to_fence_m.map(|t| t.into());
        dto.check_out_distance_to_fence_m = row.check_out_distance_to_fence_m.map(|t| t.into());
        dto.check_in_geofence_name = row.check_in_geofence_name.map(|t| t.into());
        dto.check_out_geofence_name = row.check_out_geofence_name.map(|t| t.into());
        dto.check_in_latitude = row.check_in_latitude.map(|t| t.into());
        dto.check_in_longitute = row.check_in_longitute.map(|t| t.into());
        dto.check_out_latitude = row.check_out_latitude.map(|t| t.into());
        dto.check_out_longitute = row.check_out_longitute.map(|t| t.into());
        dto.check_in_selfie_object_key = row.check_in_selfie_object_key.map(|t| t.into());
        dto.check_out_selfie_object_key = row.check_out_selfie_object_key.map(|t| t.into());
        dto.check_in_accuracy_meters = row.check_in_accuracy_meters;
        dto.check_out_accuracy_meters = row.check_out_accuracy_meters;
        dto.check_in_attendance_leave_type = row.check_in_attendance_leave_type.map(|t| t.into());
        dto.check_out_attendance_leave_type = row.check_out_attendance_leave_type.map(|t| t.into());
        dto.check_in_attendance_leave_notes = row.check_in_attendance_leave_notes.map(|t| t.into());
        dto.check_out_attendance_leave_notes = row.check_out_attendance_leave_notes.map(|t| t.into());
        dto.check_in_device_id = row.check_in_device_id.map(|t| t.into());
        dto.check_out_device_id = row.check_out_device_id.map(|t| t.into());
        dto.check_in_device_model = row.check_in_device_model.map(|t| t.into());
        dto.check_out_device_model = row.check_out_device_model.map(|t| t.into());
        dto.check_in_device_name = row.check_in_device_name.map(|t| t.into());
        dto.check_out_device_name = row.check_out_device_name.map(|t| t.into());

    } else {
        dto.session_id = Uuid::new_v4();
        dto.work_date = work_date;
        dto.user_id = user_claims.user.id;
        dto.full_name = user_claims.user.full_name;
        dto.nrp = user_claims.user.nrp;

    }


    let response = AttendanceRekapDtoResp {
        status: "200",
        data: dto,
    };

    Ok(Json(response))
}


pub async fn list_attendances(
    Query(query_params): Query<AttendanceRekapDtoQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    query_params
        .validate()
        .map_err(|e| HttpError::bad_request(format!("validate error: {}", e)))?;

    let rows = if let Some(uid) = query_params.user_id {
        app_state
            .db_client
            .list_attendance_by_user_from_to(uid, query_params.from, query_params.to)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    } else {
        app_state
            .db_client
            .list_attendance_by_user_from_to(user_claims.user_claims.user_id, query_params.from, query_params.to)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    };

    let response = AttendanceRekapsDtoResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response).into_response())
}