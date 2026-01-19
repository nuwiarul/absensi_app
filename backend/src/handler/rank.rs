use crate::AppState;
use crate::database::rank::RankRepo;
use crate::dtos::rank::{CreateRankReq, RankDto, RankResp, RanksResp, UpdateRankReq};
use crate::dtos::SuccessResponse;
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use axum::extract::Path;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

pub fn rank_handler() -> Router {
    Router::new()
        .route("/", get(list_ranks))
        .route("/{id}", get(find_rank))
        .route("/create", post(create_rank))
        .route("/update/{id}", put(update_rank))
        .route("/delete/{id}", delete(delete_rank))
}

pub async fn list_ranks(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    if !user_claims.user_claims.role.is_admin() {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let rows = app_state
        .db_client
        .list_ranks()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(RanksResp {
        status: "200",
        data: RankDto::to_rows(&rows),
    }))
}

pub async fn find_rank(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if !user_claims.user_claims.role.is_admin() {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let row = app_state
        .db_client
        .find_rank_by_id(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let rank = row.ok_or(HttpError::bad_request("Rank not found"))?;

    Ok(Json(RankResp {
        status: "200",
        data: RankDto::to_row(&rank),
    }))
}

pub async fn create_rank(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<CreateRankReq>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role != crate::auth::rbac::UserRole::Superadmin {
        return Err(HttpError::unauthorized("forbidden"));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let created = app_state
        .db_client
        .create_rank(
            payload.code,
            payload.name,
            payload.description,
            payload.tukin_base.unwrap_or(0),
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(RankResp {
        status: "200",
        data: RankDto::to_row(&created),
    }))
}

pub async fn update_rank(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateRankReq>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role != crate::auth::rbac::UserRole::Superadmin {
        return Err(HttpError::unauthorized("forbidden"));
    }

    app_state
        .db_client
        .update_rank(id, payload.code, payload.name, payload.description, payload.tukin_base)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully updated rank".to_string(),
    }))
}

pub async fn delete_rank(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role != crate::auth::rbac::UserRole::Superadmin {
        return Err(HttpError::unauthorized("forbidden"));
    }

    app_state
        .db_client
        .delete_rank(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully deleted rank".to_string(),
    }))
}
