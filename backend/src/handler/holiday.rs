use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::constants::{HolidayKind, HolidayScope};
use crate::database::holiday::{HolidayRepo, HolidayUpsertItem};
use crate::dtos::holiday::{BulkHolidayReq, BulkHolidayResp, BulkHolidayRespData};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use axum::response::IntoResponse;
use axum::routing::{post};
use axum::{Extension, Json, Router};
use chrono::NaiveTime;
use std::sync::Arc;

pub fn holiday_handler() -> Router {
    Router::new().route("/bulk", post(bulk_holidays))
}

fn parse_time_opt(s: Option<String>) -> Result<Option<NaiveTime>, HttpError> {
    match s {
        None => Ok(None),
        Some(v) => {
            // Accept "HH:MM" or "HH:MM:SS"
            let t = NaiveTime::parse_from_str(&v, "%H:%M")
                .or_else(|_| NaiveTime::parse_from_str(&v, "%H:%M:%S"))
                .map_err(|_| HttpError::bad_request(format!("half_day_end: format jam tidak valid ({})", v)))?;
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
                return Err(HttpError::bad_request("satker_id: harus null untuk scope NATIONAL"));
            }
        }
        HolidayScope::Satker => {
            let satker_id = payload
                .satker_id
                .ok_or_else(|| HttpError::bad_request("satker_id: wajib untuk scope SATKER"))?;

            let role = user_claims.user_claims.role;
            let allowed = role == UserRole::Superadmin
                || (role == UserRole::SatkerAdmin && user_claims.user_claims.satker_id == satker_id)
                || (role == UserRole::SatkerHead && user_claims.user_claims.satker_id == satker_id);

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
