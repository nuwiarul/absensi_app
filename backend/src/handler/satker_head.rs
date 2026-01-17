use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::database::satker_head::SatkerHeadRepo;
use crate::database::user::UserRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::satker::CreateSatkerReq;
use crate::dtos::satker_head::SetHeadReq;
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use axum::extract::Path;
use axum::response::IntoResponse;
use axum::routing::post;
use axum::{Extension, Json, Router};
use std::sync::Arc;
use uuid::Uuid;

pub fn satker_head_handler() -> Router {
    Router::new().route("/set/{satker_id}", post(set_satker_head))
}

pub async fn set_satker_head(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(satker_id): Path<Uuid>,
    Json(payload): Json<SetHeadReq>,
) -> Result<impl IntoResponse, HttpError> {
    if payload.user_id.is_nil() {
        return Err(HttpError::bad_request("Invalid user id".to_string()));
    }

    if user_claims.user_claims.role != UserRole::Superadmin
        && user_claims.user_claims.role != UserRole::SatkerAdmin
    {
        return Err(HttpError::bad_request("Forbidden".to_string()));
    }

    if user_claims.user_claims.role != UserRole::Superadmin
        && user_claims.user_claims.satker_id != satker_id
    {
        return Err(HttpError::bad_request(
            "Forbidden, ada bukan di satker".to_string(),
        ));
    }

    let user = app_state
        .db_client
        .find_user_by_satker(payload.user_id, satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if user.is_none() {
        return Err(HttpError::bad_request(
            "user bukan anggota satker ini /tidak aktif".to_string(),
        ));
    }

    app_state
        .db_client
        .retire_satker_head(satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    app_state
        .db_client
        .add_satker_head(satker_id, payload.user_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    app_state
        .db_client
        .set_satker_head(payload.user_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully set head satker".to_string(),
    }))
}
