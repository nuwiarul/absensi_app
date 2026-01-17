use crate::AppState;
use crate::database::satker::SatkerRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::satker::{CreateSatkerReq, SatkerDto, SatkerResp, SatkersResp, UpdateSatkerReq};
use crate::error::{ErrorMessage, HttpError};
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::utils::password::hash_password;
use axum::extract::Path;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;
use crate::constants::SUPERUSER_SATKER_ID;

pub fn satker_handler() -> Router {
    Router::new()
        .route("/", get(get_satker))
        .route("/{id}", get(find_satker))
        .route("/create", post(create_satker))
        .route("/update/{id}", put(update_satker))
        .route("/delete/{id}", delete(delete_satker))
}

pub async fn create_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<CreateSatkerReq>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satkers() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    app_state
        .db_client
        .create_satker(payload.code, payload.name)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully created satker".to_string(),
    }))
}

pub async fn update_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSatkerReq>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satkers() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    app_state
        .db_client
        .update_satker(id, payload.code, payload.name)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully updated satker".to_string(),
    }))
}

pub async fn delete_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satkers() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if id == SUPERUSER_SATKER_ID {
        return Err(HttpError::bad_request("forbidden, superuser satker tidak boleh di hapus".to_string()));
    }

    app_state
        .db_client
        .delete_satker(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully deleted satker".to_string(),
    }))
}

pub async fn find_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    let row = app_state
        .db_client
        .find_satker_by_id(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satker = row.ok_or(HttpError::bad_request("no satker found"))?;

    let satker_dto = SatkerDto::to_row(&satker);

    Ok(Json(SatkerResp {
        status: "200",
        data: satker_dto,
    }))
}

pub async fn get_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let rows = app_state
        .db_client
        .get_satker_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satker_dto = SatkerDto::to_rows(&rows);

    Ok(Json(SatkersResp {
        status: "200",
        data: satker_dto,
    }))
}
