use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::database::duty_schedule::DutyScheduleRepo;
use crate::database::satker_head::SatkerHeadRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::duty_schedule::{
    CreateDutyScheduleReq, DutySchedulesResp, ListDutySchedulesQuery, UpdateDutyScheduleReq,
    can_manage_duty_schedules,
};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{get, put};
use axum::{Extension, Json, Router};
use chrono::{Datelike, TimeZone, Utc};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

pub fn duty_schedule_handler() -> Router {
    Router::new()
        .route("/", get(list_duty_schedules).post(create_duty_schedule))
        .route(
            "/{id}",
            put(update_duty_schedule).delete(delete_duty_schedule),
        )
}

pub async fn list_duty_schedules(
    Query(query): Query<ListDutySchedulesQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    // Resolve date range
    let now = Utc::now();

    let from = query.from.unwrap_or_else(|| {
        Utc.with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
            .unwrap()
    });

    // Default "to" = first day of next month (exclusive)
    let to = query.to.unwrap_or_else(|| {
        let (y, m) = if now.month() == 12 {
            (now.year() + 1, 1)
        } else {
            (now.year(), now.month() + 1)
        };

        Utc.with_ymd_and_hms(y, m, 1, 0, 0, 0).unwrap()
    });

    // Validate range
    if to < from {
        return Err(HttpError::bad_request(
            "Tanggal end tidak boleh lebih awal dari tanggal start".to_string(),
        ));
    }

    let mut satker_id = query.satker_id;

    // satker scoping: non-superadmin forced to own satker
    if user_claims.user_claims.role != UserRole::Superadmin {
        satker_id = Some(user_claims.user_claims.satker_id);
    }

    let rows = app_state
        .db_client
        .list_duty_schedules(satker_id, query.user_id, from, to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(DutySchedulesResp {
        status: "200",
        data: rows,
    }))
}

pub async fn create_duty_schedule(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<CreateDutyScheduleReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(format!("validate error: {}", e)))?;

    // Find satker_id from user target
    let target_user = sqlx::query!(
        r#"SELECT id, satker_id FROM users WHERE id = $1"#,
        payload.user_id
    )
    .fetch_optional(&app_state.db_client.pool)
    .await
    .map_err(|e| HttpError::server_error(e.to_string()))?
    .ok_or_else(|| HttpError::bad_request("user tidak ditemukan".to_string()))?;

    let satker_id = target_user.satker_id;

    if !can_manage_duty_schedules(&user_claims.user_claims, satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if user_claims.user_claims.role == UserRole::SatkerHead {
        let ok = app_state
            .db_client
            .is_current_head_satker(satker_id, user_claims.user_claims.user_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !ok {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }

    // enforce satker for non-superadmin
    if user_claims.user_claims.role != UserRole::Superadmin
        && user_claims.user_claims.satker_id != satker_id
    {
        return Err(HttpError::unauthorized("forbidden"));
    }

    // overlap check
    let has_overlap = app_state
        .db_client
        .has_overlap(payload.user_id, payload.start_at, payload.end_at, None)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    if has_overlap {
        return Err(HttpError::bad_request(
            "jadwal dinas overlap dengan jadwal dinas lain".to_string(),
        ));
    }

    let schedule_type = payload
        .schedule_type
        .unwrap_or(crate::constants::ScheduleType::Regular);

    app_state
        .db_client
        .create_duty_schedule(
            satker_id,
            payload.user_id,
            payload.start_at,
            payload.end_at,
            schedule_type,
            payload.title,
            payload.note,
            user_claims.user_claims.user_id,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Successfully created duty schedule".to_string(),
    }))
}

pub async fn update_duty_schedule(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateDutyScheduleReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(format!("validate error: {}", e)))?;

    let existing = app_state
        .db_client
        .find_duty_schedule(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or_else(|| HttpError::bad_request("jadwal dinas tidak ditemukan".to_string()))?;

    if !can_manage_duty_schedules(&user_claims.user_claims, existing.satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if user_claims.user_claims.role == UserRole::SatkerHead {
        let ok = app_state
            .db_client
            .is_current_head_satker(existing.satker_id, user_claims.user_claims.user_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !ok {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }

    if user_claims.user_claims.role != UserRole::Superadmin
        && user_claims.user_claims.satker_id != existing.satker_id
    {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let new_start = payload.start_at.unwrap_or(existing.start_at);
    let new_end = payload.end_at.unwrap_or(existing.end_at);
    if new_end <= new_start {
        return Err(HttpError::bad_request(
            "end_at harus lebih besar dari start_at".to_string(),
        ));
    }

    let has_overlap = app_state
        .db_client
        .has_overlap(existing.user_id, new_start, new_end, Some(id))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    if has_overlap {
        return Err(HttpError::bad_request(
            "jadwal dinas overlap dengan jadwal dinas lain".to_string(),
        ));
    }

    app_state
        .db_client
        .update_duty_schedule(
            id,
            payload.start_at,
            payload.end_at,
            payload.schedule_type,
            payload.title,
            payload.note,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Successfully updated duty schedule".to_string(),
    }))
}

pub async fn delete_duty_schedule(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    let existing = app_state
        .db_client
        .find_duty_schedule(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or_else(|| HttpError::bad_request("jadwal dinas tidak ditemukan".to_string()))?;

    if !can_manage_duty_schedules(&user_claims.user_claims, existing.satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if user_claims.user_claims.role == UserRole::SatkerHead {
        let ok = app_state
            .db_client
            .is_current_head_satker(existing.satker_id, user_claims.user_claims.user_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !ok {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }

    if user_claims.user_claims.role != UserRole::Superadmin
        && user_claims.user_claims.satker_id != existing.satker_id
    {
        return Err(HttpError::unauthorized("forbidden"));
    }

    app_state
        .db_client
        .soft_delete_duty_schedule(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Successfully deleted duty schedule".to_string(),
    }))
}
