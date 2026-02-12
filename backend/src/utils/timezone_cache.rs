use crate::AppState;
use crate::database::settings::SettingsRepo;
use crate::error::HttpError;
use chrono_tz::Tz;
use redis::AsyncCommands;

const TZ_CACHE_KEY: &str = "app:settings:timezone";
const TZ_CACHE_TTL_SECS: u64 = 300; // 5 minutes

fn parse_tz_or_default(s: &str) -> Tz {
    s.parse().unwrap_or(chrono_tz::Asia::Jakarta)
}

/// Get operational timezone from Redis (cached) with DB fallback.
/// - Redis key: app:settings:timezone
/// - TTL: 5 minutes
pub async fn get_timezone_cached(app_state: &AppState) -> Result<Tz, HttpError> {
    // 1) Try Redis cache (best-effort)
    {
        let mut conn = app_state.redis_client.clone();
        if let Ok(Some(tz_str)) = conn.get::<_, Option<String>>(TZ_CACHE_KEY).await {
            return Ok(parse_tz_or_default(&tz_str));
        }
    }

    // 2) Fallback to DB
    let tz_str = app_state
        .db_client
        .get_timezone_value()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    let tz = parse_tz_or_default(&tz_str);

    // 3) Fill Redis cache (best-effort)
    {
        let mut conn = app_state.redis_client.clone();
        let _ = conn
            .set_ex::<_, _, ()>(TZ_CACHE_KEY, tz_str, TZ_CACHE_TTL_SECS)
            .await;
    }

    Ok(tz)
}

/// Update Redis cache after SUPERADMIN updates timezone.
pub async fn set_timezone_cache(app_state: &AppState, tz_str: &str) {
    let mut conn = app_state.redis_client.clone();
    let _ = conn
        .set_ex::<_, _, ()>(TZ_CACHE_KEY, tz_str, TZ_CACHE_TTL_SECS)
        .await;
}
