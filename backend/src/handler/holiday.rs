use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::constants::HolidayScope;
use crate::database::holiday::{HolidayRepo, HolidayUpsertItem};
use crate::dtos::holiday::{
    BulkHolidayReq, BulkHolidayResp, BulkHolidayRespData, DeleteHolidayQuery, DeleteHolidayResp,
    ListHolidaysQuery, ListHolidaysResp, UpsertHolidayReq, UpsertHolidayResp,
};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::services::holiday::{
    authorize_holiday_scope_access, normalize_holiday_kind_and_half_day,
};
use axum::extract::Query;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use std::sync::Arc;

pub fn holiday_handler() -> Router {
    Router::new().route("/bulk", post(bulk_holidays)).route(
        "/",
        get(list_holidays)
            .put(upsert_holiday)
            .delete(delete_holiday),
    )
}

pub async fn bulk_holidays(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<BulkHolidayReq>,
) -> Result<impl IntoResponse, HttpError> {
    if payload.items.is_empty() {
        return Err(HttpError::bad_request("items: wajib diisi"));
    }

    // Authz
    authorize_holiday_scope_access(
        user_claims.user_claims.role,
        user_claims.user_claims.satker_id,
        payload.scope,
        payload.satker_id,
    )?;

    let mut items: Vec<HolidayUpsertItem> = Vec::with_capacity(payload.items.len());
    for it in payload.items {
        let (kind, half_day_end) = normalize_holiday_kind_and_half_day(it.kind, it.half_day_end)?;
        items.push(HolidayUpsertItem {
            holiday_date: it.holiday_date,
            kind,
            name: it.name,
            half_day_end,
        });
    }

    let affected = app_state
        .db_client
        .bulk_upsert_holidays(payload.scope, payload.satker_id, items)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(BulkHolidayResp {
        status: "200".to_string(),
        data: BulkHolidayRespData {
            affected_rows: affected,
        },
    }))
}

pub async fn list_holidays(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Query(q): Query<ListHolidaysQuery>,
) -> Result<impl IntoResponse, HttpError> {
    if q.to < q.from {
        return Err(HttpError::bad_request("to: harus >= from"));
    }

    let role = user_claims.user_claims.role;

    // Authz + normalize
    let (scope, satker_id) = match role {
        UserRole::Superadmin => {
            if q.scope == Some(HolidayScope::Satker) && q.satker_id.is_none() {
                return Err(HttpError::bad_request(
                    "satker_id: wajib untuk scope=SATKER",
                ));
            }
            (q.scope, q.satker_id)
        }
        UserRole::SatkerAdmin | UserRole::SatkerHead => {
            // Satker roles: always list own satker + NATIONAL
            (None, Some(user_claims.user_claims.satker_id))
        }
        _ => return Err(HttpError::unauthorized("forbidden")),
    };

    let rows = app_state
        .db_client
        .list_holidays_admin(scope, satker_id, q.from, q.to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(ListHolidaysResp {
        status: "200".to_string(),
        data: rows,
    }))
}

pub async fn upsert_holiday(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<UpsertHolidayReq>,
) -> Result<impl IntoResponse, HttpError> {
    // Authz
    authorize_holiday_scope_access(
        user_claims.user_claims.role,
        user_claims.user_claims.satker_id,
        payload.scope,
        payload.satker_id,
    )?;

    let (kind, half_day_end) =
        normalize_holiday_kind_and_half_day(payload.kind, payload.half_day_end)?;

    app_state
        .db_client
        .upsert_holiday(
            payload.scope,
            payload.satker_id,
            HolidayUpsertItem {
                holiday_date: payload.holiday_date,
                kind,
                name: payload.name,
                half_day_end,
            },
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(UpsertHolidayResp {
        status: "200".to_string(),
        data: "ok".to_string(),
    }))
}

pub async fn delete_holiday(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Query(q): Query<DeleteHolidayQuery>,
) -> Result<impl IntoResponse, HttpError> {
    // Authz
    authorize_holiday_scope_access(
        user_claims.user_claims.role,
        user_claims.user_claims.satker_id,
        q.scope,
        q.satker_id,
    )?;

    let affected = app_state
        .db_client
        .delete_holiday(q.scope, q.satker_id, q.holiday_date)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if affected == 0 {
        return Err(HttpError::bad_request("holiday: tidak ditemukan"));
    }

    Ok(Json(DeleteHolidayResp {
        status: "200".to_string(),
        data: "ok".to_string(),
    }))
}
