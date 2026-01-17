use crate::AppState;
use crate::database::satker::SatkerRepo;
use crate::database::user::UserRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::user::{CreateUserReq, UpdateUserReq, UserDto, UserResp, UsersResp};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::utils::password::hash_password;
use axum::extract::Path;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;
use crate::constants::{SUPERUSER_SATKER_ID, SUPERUSER_USER_ID};

pub fn user_handler() -> Router {
    Router::new()
        .route("/create", post(create_user))
        .route("/update/{id}", put(update_user))
        .route("/delete/{id}", delete(delete_user))
        .route("/{id}", get(find_user))
        .route("/satkers/{satker_id}", get(all_user_by_satker))
        .route("/", get(all_user))
}

pub async fn create_user(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<CreateUserReq>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satker_users() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let satker_id =
        Uuid::parse_str(&payload.satker_id).map_err(|e| HttpError::bad_request(e.to_string()))?;

    let hash_password =
        hash_password(&payload.password).map_err(|e| HttpError::bad_request(e.to_string()))?;

    app_state
        .db_client
        .create_user(
            satker_id,
            payload.nrp,
            payload.full_name,
            Some(payload.email),
            payload.phone,
            payload.role.unwrap(),
            hash_password,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully created user".to_string(),
    }))
}

pub async fn update_user(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateUserReq>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satker_users() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    app_state
        .db_client
        .update_user(
            id,
            payload.satker_id,
            payload.nrp,
            payload.full_name,
            payload.email,
            payload.phone,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully updated user".to_string(),
    }))
}

pub async fn delete_user(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satker_users() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if id == SUPERUSER_USER_ID {
        return Err(HttpError::bad_request("forbidden, superuser tidak boleh di hapus".to_string()));
    }

    app_state
        .db_client
        .delete_user(
            id,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully deleted user".to_string(),
    }))
}

pub async fn all_user_by_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>,
    Path(satker_id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    let users = app_state
        .db_client
        .get_user_by_satker_id(satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satkers = app_state
        .db_client
        .get_satker_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let users_dto = UserDto::to_rows_with_satker(&users, &satkers);

    Ok(Json(UsersResp {
        status: "200",
        data: users_dto,
    }))
}

pub async fn all_user(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let users = app_state
        .db_client
        .get_user_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satkers = app_state
        .db_client
        .get_satker_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let users_dto = UserDto::to_rows_with_satker(&users, &satkers);

    Ok(Json(UsersResp {
        status: "200",
        data: users_dto,
    }))
}

pub async fn find_user(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    let row = app_state
        .db_client
        .find_user_by_id(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let user = row.ok_or(HttpError::bad_request("User not found"))?;

    let satkers = app_state
        .db_client
        .get_satker_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let user_dto = UserDto::to_row_with_satker(&user, &satkers);

    Ok(Json(UserResp {
        status: "200",
        data: user_dto,
    }))
}
