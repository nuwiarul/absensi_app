use std::sync::Arc;

use axum::{
    Extension, Json, Router,
    extract::{Path, Query},
    routing::{get, put},
};
use chrono::NaiveDate;
use uuid::Uuid;

use crate::auth::rbac::UserRole;
use crate::constants::CalendarDayType;
use crate::database::work_calendar::WorkCalendarRepo;
use crate::dtos::working_days::{
    ListWorkingDaysQuery, UpsertWorkingDayReq, WorkingDayDto, WorkingDayResp, WorkingDaysResp,
};
use crate::utils::time_parser::parse_optional_time_field;
use crate::{AppState, error::HttpError, middleware::auth_middleware::AuthMiddleware};

#[derive(serde::Serialize)]
struct StatusOnlyResp {
    status: &'static str,
}

fn parse_date(s: &str) -> Result<NaiveDate, HttpError> {
    NaiveDate::parse_from_str(s, "%Y-%m-%d")
        .map_err(|_| HttpError::bad_request("work_date: format harus YYYY-MM-DD"))
}

fn can_manage(user: &crate::middleware::auth_middleware::UserClaims, satker_id: Uuid) -> bool {
    user.role == UserRole::Superadmin
        || ((user.role == UserRole::SatkerAdmin || user.role == UserRole::SatkerHead)
            && user.satker_id == satker_id)
}

fn can_view(user: &crate::middleware::auth_middleware::UserClaims, satker_id: Uuid) -> bool {
    user.role == UserRole::Superadmin || user.satker_id == satker_id
}

pub async fn list_working_days(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Query(q): Query<ListWorkingDaysQuery>,
) -> Result<impl axum::response::IntoResponse, HttpError> {
    if q.to < q.from {
        return Err(HttpError::bad_request("to: harus >= from"));
    }

    if !can_view(&user_claims.user_claims, q.satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let rows = app_state
        .db_client
        .list_calendar_days(q.satker_id, q.from, q.to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(WorkingDaysResp {
        status: "200",
        data: WorkingDayDto::from_rows(&rows),
    }))
}

pub async fn upsert_working_day(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path((satker_id, work_date)): Path<(Uuid, String)>,
    Json(payload): Json<UpsertWorkingDayReq>,
) -> Result<impl axum::response::IntoResponse, HttpError> {
    if !can_manage(&user_claims.user_claims, satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let work_date = parse_date(&work_date)?;

    // Minimal validation for time fields depending on day_type.
    let expected_start =
        parse_optional_time_field(payload.expected_start.as_deref(), "expected_start")?;
    let expected_end = parse_optional_time_field(payload.expected_end.as_deref(), "expected_end")?;

    match payload.day_type {
        CalendarDayType::Holiday => {
            // Holiday should not have expected times.
        }
        CalendarDayType::Workday | CalendarDayType::HalfDay => {
            if expected_start.is_none() || expected_end.is_none() {
                return Err(HttpError::bad_request(
                    "expected_start & expected_end wajib untuk WORKDAY/HALF_DAY",
                ));
            }
            if expected_end.unwrap() <= expected_start.unwrap() {
                return Err(HttpError::bad_request(
                    "expected_end harus > expected_start",
                ));
            }
        }
    }

    let (final_start, final_end) = match payload.day_type {
        CalendarDayType::Holiday => (None, None),
        _ => (expected_start, expected_end),
    };

    app_state
        .db_client
        .upsert_calendar_day(
            satker_id,
            work_date,
            payload.day_type,
            final_start,
            final_end,
            payload.note.clone(),
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Read-back row for response
    let rows = app_state
        .db_client
        .list_calendar_days(satker_id, work_date, work_date)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    let row = rows
        .get(0)
        .ok_or_else(|| HttpError::server_error("failed to read back working day"))?;

    Ok(Json(WorkingDayResp {
        status: "200",
        data: WorkingDayDto::from_row(row),
    }))
}

pub async fn delete_working_day(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path((satker_id, work_date)): Path<(Uuid, String)>,
) -> Result<impl axum::response::IntoResponse, HttpError> {
    if !can_manage(&user_claims.user_claims, satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let work_date = parse_date(&work_date)?;

    app_state
        .db_client
        .delete_calendar_day(satker_id, work_date)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(StatusOnlyResp { status: "200" }))
}

pub fn working_days_handler() -> Router {
    Router::new().route("/", get(list_working_days)).route(
        "/{satker_id}/{work_date}",
        put(upsert_working_day).delete(delete_working_day),
    )
}
