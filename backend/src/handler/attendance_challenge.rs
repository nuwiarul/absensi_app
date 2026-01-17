use crate::AppState;
use crate::dtos::SuccessResponse;
use crate::dtos::attendance_challenge::{ChallengeDto, ChallengePayload, ChallengeResp, LastLoc};
use crate::dtos::geofence::{CreateGeofenceReq, can_manage_geofence};
use crate::error::{ErrorMessage, HttpError};
use crate::middleware::auth_middleware::{AuthMiddleware, UserClaims};
use axum::extract::Path;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Extension, Json, Router};
use chrono::Utc;
use redis::AsyncCommands;
use std::sync::Arc;
use axum::http::HeaderMap;
use uuid::Uuid;

pub fn attendance_challenge_handler() -> Router {
    Router::new().route("/", post(create_challenge))
}

fn header_string(headers: &HeaderMap, key: &str) -> Option<String> {
    headers.get(key)?.to_str().ok().map(|s| s.trim().to_string())
}

pub async fn create_challenge(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    headers: HeaderMap,
) -> Result<impl IntoResponse, HttpError> {

    let device_id = header_string(&headers, "X-Device-Id")
        .ok_or_else(|| HttpError::bad_request("missing header X-Device-Id".to_string()))?;

    {
        /*let mut con = app_state.redis_client.clone();
        let rl_key = format!("att_chal_rl:{}", user_claims.user_claims.user_id);
        let cnt: i64 = con
            .incr(&rl_key, 1)
            .await
            .map_err(|_| HttpError::server_error("Save to redis error".to_string()))?;
        if cnt == 1 {
            let _: () = con
                .expire(&rl_key, 60)
                .await
                .map_err(|_| HttpError::server_error("Save to redis error".to_string()))?;
        }

        if cnt > 10 {
            return Err(HttpError::bad_request(
                "terlalu banyak request challenge, coba lagi sebentar".to_string(),
            ));
        }*/
        let mut con = app_state.redis_client.clone();

        // per user: 10/60s
        let rl_user_key = format!("att_chal_rl:user:{}", user_claims.user_claims.user_id);
        let user_cnt: i64 = con
            .incr(&rl_user_key, 1)
            .await
            .map_err(|_| HttpError::server_error("Save to redis error".to_string()))?;
        if user_cnt == 1 {
            let _: () = con
                .expire(&rl_user_key, 60)
                .await
                .map_err(|_| HttpError::server_error("Save to redis error".to_string()))?;
        }
        if user_cnt > 10 {
            return Err(HttpError::too_many_requests(
                "terlalu banyak request challenge, coba lagi sebentar".to_string(),
            ));
        }

        // per device: 6/60s
        let rl_dev_key = format!("att_chal_rl:dev:{device_id}");
        let dev_cnt: i64 = con
            .incr(&rl_dev_key, 1)
            .await
            .map_err(|_| HttpError::server_error("Save to redis error".to_string()))?;
        if dev_cnt == 1 {
            let _: () = con
                .expire(&rl_dev_key, 60)
                .await
                .map_err(|_| HttpError::server_error("Save to redis error".to_string()))?;
        }
        if dev_cnt > 6 {
            return Err(HttpError::too_many_requests(
                "terlalu banyak request challenge dari device ini, coba lagi sebentar".to_string(),
            ));
        }
    }

    let challenge_id = Uuid::new_v4();
    let nonce = Uuid::new_v4().to_string();
    let expires_at = Utc::now() + chrono::Duration::seconds(60);

    let payload = ChallengePayload {
        user_id: user_claims.user_claims.user_id,
        satker_id: user_claims.user_claims.satker_id,
        nonce: nonce.clone(),
        device_id: device_id.clone(), // ✅
        exp_unix: expires_at.timestamp(),
    };

    let key = format!("att_chal:{challenge_id}");
    let val = serde_json::to_string(&payload)
        .map_err(|_| HttpError::server_error("Failed to serialize payload".to_string()))?;

    let mut con = app_state.redis_client.clone();

    let _: () = con.set_ex(key, val, 60).await.map_err(|_| {
        HttpError::server_error("Failed to save challenge to redis server".to_string())
    })?;

    let challenge_dto = ChallengeDto {
        challenge_id,
        nonce,
        expires_at,
    };

    let response = ChallengeResp {
        status: "200",
        data: challenge_dto,
    };

    Ok(Json(response))
}

pub async fn validate_and_use_challenge(
    app_state: &Arc<AppState>,
    user_claims: &UserClaims,
    challenge_id: Uuid,
    device_id: &str,
) -> Result<(), HttpError> {
    let key = format!("att_chal:{challenge_id}");

    // Lua:
    // 1) GET key
    // 2) if nil => return -1
    // 3) decode JSON (di server Rust, bukan di Lua) -> jadi Lua cukup GET + DEL atomik pakai GETDEL jika ada
    //
    // Karena redis-rs belum pasti support GETDEL di semua env, kita pakai Lua yang return value lalu DEL:
    let script = redis::Script::new(
        r#"
        local val = redis.call("GET", KEYS[1])
        if not val then
          return nil
        end
        redis.call("DEL", KEYS[1])
        return val
        "#,
    );

    let mut con = app_state.redis_client.clone();
    let val: Option<String> = script.key(&key).invoke_async(&mut con).await.map_err(|_| {
        HttpError::server_error("Failed to retrieve challenge from redis server".to_string())
    })?;

    let val = val.ok_or(HttpError::bad_request(
        "challenge tidak ditemukan / sudah expired / sudah dipakai".to_string(),
    ))?;

    let payload: ChallengePayload = serde_json::from_str(&val)
        .map_err(|_| HttpError::server_error("Failed to deserialize challenge".to_string()))?;

    if payload.user_id != user_claims.user_id || payload.satker_id != user_claims.satker_id {
        return Err(HttpError::unauthorized(ErrorMessage::ForbiddenRequest.to_string()));
    }

    if payload.device_id != device_id {
        return Err(HttpError::unauthorized(ErrorMessage::ForbiddenRequest.to_string()));
    }

    if payload.exp_unix < Utc::now().timestamp() {
        return Err(HttpError::bad_request("challenge sudah expired".to_string()));
    }

    Ok(())
}

pub async fn anti_teleport_check(
    app_state: &Arc<AppState>,
    user_id: Uuid,
    device_id: &str,
    lat: f64,
    lon: f64,
) -> Result<(), HttpError> {
    let key = format!("att:lastloc:{user_id}:{device_id}");
    let now = Utc::now().timestamp();

    let mut con = app_state.redis_client.clone();

    let prev_json: Option<String> = con.get(&key).await
        .map_err(|_| HttpError::server_error("redis error".to_string()))?;

    if let Some(prev_json) = prev_json {
        if let Ok(prev) = serde_json::from_str::<LastLoc>(&prev_json) {
            let dt = (now - prev.ts_unix).max(1);
            let dist_m = crate::utils::fungsi::haversine_m(lat, lon, prev.lat, prev.lon);

            // teleport: > 5km in < 2 minutes
            if dt < 120 && dist_m > 5000.0 {
                return Err(HttpError::bad_request("terdeteksi perpindahan lokasi tidak wajar".to_string()));
            }

            // speed: > 45 m/s
            let speed = dist_m / (dt as f64);
            if speed > 45.0 {
                return Err(HttpError::bad_request("terdeteksi kecepatan perpindahan tidak wajar".to_string()));
            }
        }
    }

    let val = serde_json::to_string(&LastLoc { lat, lon, ts_unix: now })
        .map_err(|_| HttpError::server_error("serialize error".to_string()))?;

    // TTL 1 hari
    let _: () = con.set_ex(key, val, 86400).await
        .map_err(|_| HttpError::server_error("redis error".to_string()))?;

    Ok(())
}


/*
pub async fn validate_and_use_challenge(
    app_state: &Arc<AppState>,
    user_claims: &UserClaims,
    challenge_id: Uuid,
) -> Result<impl IntoResponse, HttpError> {
    let key = format!("att_chal:{challenge_id}");

    // Lua:
    // 1) GET key
    // 2) if nil => return -1
    // 3) decode JSON (di server Rust, bukan di Lua) -> jadi Lua cukup GET + DEL atomik pakai GETDEL jika ada
    //
    // Karena redis-rs belum pasti support GETDEL di semua env, kita pakai Lua yang return value lalu DEL:
    let script = redis::Script::new(
        r#"
        local val = redis.call("GET", KEYS[1])
        if not val then
          return nil
        end
        redis.call("DEL", KEYS[1])
        return val
        "#,
    );

    let mut con = app_state.redis_client.clone();
    let val: Option<String> = script.key(&key).invoke_async(&mut con).await.map_err(|_| {
        HttpError::server_error("Failed to retrieve challenge from redis server".to_string())
    })?;

    let val = val.ok_or(HttpError::bad_request(
        "challenge tidak ditemukan / sudah expired / sudah dipakai".to_string(),
    ))?;

    let payload: ChallengePayload = serde_json::from_str(&val)
        .map_err(|_| HttpError::server_error("Failed to deserialize challenge".to_string()))?;

    if payload.user_id != user_claims.user_id || payload.satker_id != user_claims.satker_id {
        return Err(HttpError::unauthorized(ErrorMessage::ForbiddenRequest.to_string()));
    }

    if payload.exp_unix < Utc::now().timestamp() {
        return Err(HttpError::bad_request("challenge sudah expired".to_string()));
    }

    Ok(())
}

 */
