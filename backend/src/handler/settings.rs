use crate::AppState;
use crate::database::settings::{SETTING_DEFAULT_TIMEZONE, SettingsRepo};
use crate::dtos::settings::{TimezoneData, TimezoneResp, UpdateTimezoneReq};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::utils::timezone_cache::set_timezone_cache;
use axum::routing::get;
use axum::{Extension, Json, Router};
use chrono::{Datelike, Utc};
use chrono_tz::Tz;
use std::str::FromStr;
use std::sync::Arc;

pub fn settings_handler() -> Router {
    Router::new().route("/timezone", get(get_timezone).put(update_timezone))
}

pub async fn get_timezone(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_auth): Extension<AuthMiddleware>,
) -> Result<Json<TimezoneResp>, HttpError> {
    let tz_value = app_state
        .db_client
        .get_timezone_value()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let tz: Tz = Tz::from_str(&tz_value).unwrap_or(chrono_tz::Asia::Jakarta);
    let current_year = Utc::now().with_timezone(&tz).year();

    Ok(Json(TimezoneResp {
        status: "200",
        data: TimezoneData {
            timezone: tz_value,
            current_year,
        },
    }))
}

pub async fn update_timezone(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(auth): Extension<AuthMiddleware>,
    Json(body): Json<UpdateTimezoneReq>,
) -> Result<Json<TimezoneResp>, HttpError> {
    // Only SUPERADMIN can update global settings.
    if auth.user_claims.role != crate::auth::rbac::UserRole::Superadmin {
        return Err(HttpError::bad_request(
            "hanya SUPERADMIN yang boleh mengubah timezone",
        ));
    }

    // Validate timezone value.
    let tz: Tz = match Tz::from_str(&body.timezone) {
        Ok(tz) => tz,
        Err(_) => {
            return Err(HttpError::bad_request(
                "timezone tidak valid. Gunakan Asia/Jakarta, Asia/Makassar, atau Asia/Jayapura",
            ));
        }
    };

    // Restrict to Indonesia zones we support.
    let allowed = matches!(
        body.timezone.as_str(),
        "Asia/Jakarta" | "Asia/Makassar" | "Asia/Jayapura"
    );
    if !allowed {
        return Err(HttpError::bad_request(
            "timezone tidak didukung. Pilih Asia/Jakarta (WIB), Asia/Makassar (WITA), atau Asia/Jayapura (WIT)",
        ));
    }

    app_state
        .db_client
        .upsert_setting(
            SETTING_DEFAULT_TIMEZONE,
            &body.timezone,
            auth.user_claims.user_id,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Keep Redis cache in sync (best-effort) with TTL 5 minutes.
    set_timezone_cache(&app_state, &body.timezone).await;

    let current_year = Utc::now().with_timezone(&tz).year();
    Ok(Json(TimezoneResp {
        status: "200",
        data: TimezoneData {
            timezone: body.timezone,
            current_year,
        },
    }))
}
