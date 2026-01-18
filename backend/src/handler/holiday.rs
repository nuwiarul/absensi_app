use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::constants::{HolidayKind, HolidayScope};
use crate::database::holiday::{HolidayRepo, HolidayUpsertItem};
use crate::dtos::holiday::{
    BulkHolidayReq, BulkHolidayResp, BulkHolidayRespData, DeleteHolidayQuery, DeleteHolidayResp,
    ListHolidaysQuery, ListHolidaysResp, UpsertHolidayReq, UpsertHolidayResp,
};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use axum::extract::Query;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use chrono::NaiveTime;
use std::sync::Arc;

pub fn holiday_handler() -> Router {
    Router::new()
        .route("/bulk", post(bulk_holidays))
        .route("/", get(list_holidays).put(upsert_holiday).delete(delete_holiday))
}

fn parse_time_opt(s: Option<String>) -> Result<Option<NaiveTime>, HttpError> {
    match s {
        None => Ok(None),
        Some(v) => {
            // Accept "HH:MM" or "HH:MM:SS"
            let t = NaiveTime::parse_from_str(&v, "%H:%M")
                .or_else(|_| NaiveTime::parse_from_str(&v, "%H:%M:%S"))
                .map_err(|_| {
                    HttpError::bad_request(format!(
                        "half_day_end: format jam tidak valid ({})",
                        v
                    ))
                })?;
            Ok(Some(t))
        }
    }
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
    match payload.scope {
        HolidayScope::National => {
            if user_claims.user_claims.role != UserRole::Superadmin {
                return Err(HttpError::unauthorized("forbidden"));
            }
            if payload.satker_id.is_some() {
                return Err(HttpError::bad_request(
                    "satker_id: harus null untuk scope NATIONAL",
                ));
            }
        }
        HolidayScope::Satker => {
            let satker_id = payload
                .satker_id
                .ok_or_else(|| HttpError::bad_request("satker_id: wajib untuk scope SATKER"))?;

            let role = user_claims.user_claims.role;
            let allowed = role == UserRole::Superadmin
                || (role == UserRole::SatkerAdmin
                && user_claims.user_claims.satker_id == satker_id)
                || (role == UserRole::SatkerHead
                && user_claims.user_claims.satker_id == satker_id);

            if !allowed {
                return Err(HttpError::unauthorized("forbidden"));
            }
        }
    }

    let mut items: Vec<HolidayUpsertItem> = Vec::with_capacity(payload.items.len());
    for it in payload.items {
        let kind = it.kind.unwrap_or(HolidayKind::Holiday);
        let half_day_end = parse_time_opt(it.half_day_end)?;
        if kind == HolidayKind::Holiday && half_day_end.is_some() {
            return Err(HttpError::bad_request(
                "half_day_end: hanya boleh diisi jika kind=HALF_DAY",
            ));
        }
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
                return Err(HttpError::bad_request("satker_id: wajib untuk scope=SATKER"));
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
    let role = user_claims.user_claims.role;

    // Authz
    match payload.scope {
        HolidayScope::National => {
            if role != UserRole::Superadmin {
                return Err(HttpError::unauthorized("forbidden"));
            }
            if payload.satker_id.is_some() {
                return Err(HttpError::bad_request(
                    "satker_id: harus null untuk scope NATIONAL",
                ));
            }
        }
        HolidayScope::Satker => {
            let sid = payload
                .satker_id
                .ok_or_else(|| HttpError::bad_request("satker_id: wajib untuk scope SATKER"))?;
            let allowed = role == UserRole::Superadmin
                || ((role == UserRole::SatkerAdmin || role == UserRole::SatkerHead)
                && user_claims.user_claims.satker_id == sid);
            if !allowed {
                return Err(HttpError::unauthorized("forbidden"));
            }
        }
    }

    let kind = payload.kind.unwrap_or(HolidayKind::Holiday);
    let half_day_end = parse_time_opt(payload.half_day_end)?;
    if kind == HolidayKind::Holiday && half_day_end.is_some() {
        return Err(HttpError::bad_request(
            "half_day_end: hanya boleh diisi jika kind=HALF_DAY",
        ));
    }

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
    let role = user_claims.user_claims.role;

    // Authz
    match q.scope {
        HolidayScope::National => {
            if role != UserRole::Superadmin {
                return Err(HttpError::unauthorized("forbidden"));
            }
            if q.satker_id.is_some() {
                return Err(HttpError::bad_request(
                    "satker_id: harus null untuk scope NATIONAL",
                ));
            }
        }
        HolidayScope::Satker => {
            let sid = q
                .satker_id
                .ok_or_else(|| HttpError::bad_request("satker_id: wajib untuk scope SATKER"))?;
            let allowed = role == UserRole::Superadmin
                || ((role == UserRole::SatkerAdmin || role == UserRole::SatkerHead)
                && user_claims.user_claims.satker_id == sid);
            if !allowed {
                return Err(HttpError::unauthorized("forbidden"));
            }
        }
    }

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
