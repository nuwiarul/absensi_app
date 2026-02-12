use axum::routing::post;
use axum::{Extension, Json, Router, extract::Multipart, response::IntoResponse};
use std::sync::Arc;

use crate::AppState;
use crate::dtos::upload::{UploadSelfieData, UploadSelfieResp};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::services::upload::save_selfie_upload;

pub fn uploads_handler() -> Router {
    Router::new().route("/selfie", post(upload_selfie))
}

pub async fn upload_selfie(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    mp: Multipart,
) -> Result<impl IntoResponse, HttpError> {
    let key =
        save_selfie_upload(&app_state.upload_dir, user_claims.user_claims.user_id, mp).await?;

    Ok(Json(UploadSelfieResp {
        status: "200",
        data: UploadSelfieData {
            selfie_object_key: key,
        },
    }))
}
