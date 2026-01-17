use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::database::schedule::ScheduleRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::schedule::{CreateScheduleReq, ScheduleQuery, SchedulesResp, can_manage_schedule};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use chrono::{NaiveDate, NaiveTime};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

pub fn schedule_handler() -> Router {
    Router::new()
        .route("/create/{satker_id}", post(create_schedule))
        .route("/{satker_id}", get(list_satker_schedules))
}

pub async fn create_schedule(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(satker_id): Path<Uuid>,
    Json(payload): Json<CreateScheduleReq>,
) -> Result<impl IntoResponse, HttpError> {
    if !can_manage_schedule(&user_claims.user_claims, satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(format!("validate error: {}", e)))?;

    if user_claims.user_claims.role != UserRole::Superadmin {
        if user_claims.user_claims.satker_id != satker_id {
            return Err(HttpError::bad_request(
                "user bukan anggota satker ini / tidak aktif".to_string(),
            ));
        }
    }

    let start_time = payload.start_time.parse::<NaiveTime>().ok();
    let end_time = payload.end_time.parse::<NaiveTime>().ok();

    app_state
        .db_client
        .create_schedule(
            satker_id,
            payload.user_id,
            payload.schedule_date,
            payload.schedule_type,
            start_time,
            end_time,
            payload.notes,
            user_claims.user_claims.user_id,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully created schedule".to_string(),
    }))
}

pub async fn list_satker_schedules(
    Query(query_params): Query<ScheduleQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(satker_id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    query_params
        .validate()
        .map_err(|e| HttpError::bad_request(format!("validate error: {}", e)))?;

    if user_claims.user_claims.role == UserRole::Member {
        if user_claims.user_claims.satker_id != satker_id {
            return Err(HttpError::bad_request(
                "Bukan anggota satker ini / tidak aktif",
            ));
        }

        return Ok(list_my_schedule_inner(
            &app_state,
            user_claims.user_claims.user_id,
            query_params.from,
            query_params.to,
        )
        .await?.into_response());
    }

    if !can_manage_schedule(&user_claims.user_claims, satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let rows = if let Some(uid) = query_params.user_id {
        app_state
            .db_client
            .list_satker_schedule_user(satker_id, uid, query_params.from, query_params.to)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    } else {
        app_state
            .db_client
            .list_satker_schedule(satker_id, query_params.from, query_params.to)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    };

    let response = SchedulesResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response).into_response())
}

async fn list_my_schedule_inner(
    app_state: &Arc<AppState>,
    user_id: Uuid,
    from: NaiveDate,
    to: NaiveDate,
) -> Result<impl IntoResponse, HttpError> {
    let rows = app_state
        .db_client
        .list_my_schedule(user_id, from, to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let response = SchedulesResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response))
}
