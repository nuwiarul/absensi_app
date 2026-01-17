use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::database::satker::SatkerRepo;
use crate::database::user::UserRepo;
use crate::error::{ErrorMessage, HttpError};
use crate::models::{Satker, User};
use crate::utils::token::decode_token;
use axum::Extension;
use axum::extract::Request;
use axum::http::header::AUTHORIZATION;
use axum::middleware::Next;
use axum::response::IntoResponse;
use axum_extra::extract::CookieJar;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct UserClaims {
    pub user_id: Uuid,
    pub satker_id: Uuid,
    pub role: UserRole,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AuthMiddleware {
    pub user_claims: UserClaims,
    pub user: User,
    pub satker: Satker,
}

pub async fn auth_middleware(
    cookie_jar: CookieJar,
    Extension(app_state): Extension<Arc<AppState>>,
    mut req: Request,
    next: Next,
) -> Result<impl IntoResponse, HttpError> {
    let cookie = cookie_jar
        .get("token")
        .map(|c| c.value().to_string())
        .or_else(|| {
            req.headers()
                .get(AUTHORIZATION)
                .and_then(|h| h.to_str().ok())
                .and_then(|h| {
                    if h.starts_with("Bearer ") {
                        //Some(h[7..].to_string())
                        Some(h.trim_start_matches("Bearer ").to_string())
                    } else {
                        None
                    }
                })
        });

    let token = cookie.ok_or(HttpError::unauthorized(
        ErrorMessage::TokenNotProvided.to_string(),
    ))?;

    let token_details = match decode_token(&token, app_state.env.jwt_secret.as_bytes()) {
        Ok(details) => details,
        Err(_) => {
            return Err(HttpError::unauthorized(
                ErrorMessage::InvalidToken.to_string(),
            ));
        }
    };

    let user_id = Uuid::parse_str(&token_details)
        .map_err(|_| HttpError::unauthorized(ErrorMessage::InvalidToken.to_string()))?;

    let user = app_state
        .db_client
        .find_user_by_id(user_id)
        .await
        .map_err(|_| HttpError::server_error(ErrorMessage::ServerError.to_string()))?;

    let user = user.ok_or(HttpError::unauthorized(
        ErrorMessage::UserNoLongerExists.to_string(),
    ))?;

    if !user.is_active {
        return Err(HttpError::unauthorized(
            ErrorMessage::UserNoLongerExists.to_string(),
        ));
    }

    let satker = app_state
        .db_client
        .find_satker_by_id(user.satker_id)
        .await
        .map_err(|_| HttpError::server_error(ErrorMessage::ServerError.to_string()))?;

    let satker = satker.ok_or(HttpError::server_error(ErrorMessage::SatkerNoLonger.to_string()))?;

    let user_claims = UserClaims {
        user_id: user.id,
        satker_id: user.satker_id,
        role: user.role,
    };

    req.extensions_mut()
        .insert(AuthMiddleware { user_claims, user, satker });

    Ok(next.run(req).await)
}
