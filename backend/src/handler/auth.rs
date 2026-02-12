use crate::AppState;
use crate::auth::client_channel::{ClientChannel, is_login_allowed};
use crate::database::satker::SatkerRepo;
use crate::database::user::UserRepo;
use crate::dtos::auth::{LoginDto, LoginReq, LoginResp};
use crate::error::{ErrorMessage, HttpError};
use crate::utils::password::compare_password;
use crate::utils::token::create_token;
use axum::http::HeaderMap;
use axum::http::header::SET_COOKIE;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Extension, Json, Router};
use axum_extra::extract::cookie::Cookie;
use std::sync::Arc;
use validator::Validate;

pub fn auth_handler() -> Router {
    Router::new().route("/login", post(login_user))
}

pub async fn login_user(
    Extension(app_state): Extension<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<LoginReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let result = app_state
        .db_client
        .find_user_by_nrp(payload.username)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let user = result.ok_or(HttpError::unauthorized(
        ErrorMessage::WrongCredentials.to_string(),
    ))?;

    let password_match = compare_password(&payload.password, &user.password_hash)
        .map_err(|_| HttpError::bad_request(ErrorMessage::WrongCredentials.to_string()))?;

    if !password_match {
        return Err(HttpError::bad_request(
            ErrorMessage::WrongCredentials.to_string(),
        ));
    }

    // ✅ aturan bisnis login channel vs role
    let channel = ClientChannel::from_headers(&headers);
    if !is_login_allowed(user.role, channel) {
        return Err(HttpError::unauthorized(format!(
            "role {:?} tidak boleh login dari channel {:?}",
            user.role, channel
        )));
    }

    let token = create_token(
        &user.id.to_string(),
        app_state.env.jwt_secret.as_bytes(),
        app_state.env.jwt_maxage,
    )
    .map_err(|e| HttpError::server_error(e.to_string()))?;

    let mut headers = HeaderMap::new();

    let cookie_time = time::Duration::minutes(app_state.env.jwt_maxage * 60);
    let cookie = Cookie::build(("token", token.clone()))
        .path("/")
        .max_age(cookie_time)
        .http_only(true)
        .build();
    headers.append(SET_COOKIE, cookie.to_string().parse().unwrap());

    let satker = app_state
        .db_client
        .find_satker_by_id(user.satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satker = satker.ok_or(HttpError::unauthorized(
        "Satker tidak di temukan".to_string(),
    ))?;

    let login_dto = LoginDto::to_row(token, &user, &satker);

    let response = LoginResp {
        status: "200",
        data: login_dto,
    };

    Ok(Json(response))
}
