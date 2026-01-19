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

    /*let satker_id =
        Uuid::parse_str(&payload.satker_id).map_err(|e| HttpError::bad_request(e.to_string()))?;*/

    let requested_satker_id =
        Uuid::parse_str(&payload.satker_id).map_err(|e| HttpError::bad_request(e.to_string()))?;

    let rank_id: Option<Uuid> = match payload.rank_id.as_deref() {
        None | Some("") => None,
        Some(v) => Some(Uuid::parse_str(v).map_err(|e| HttpError::bad_request(e.to_string()))?),
    };

    // SATKER_ADMIN can only create users for their own satker.
    let satker_id = if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin {
        if user_claims.user_claims.satker_id != requested_satker_id {
            return Err(HttpError::unauthorized("forbidden"));
        }
        user_claims.user_claims.satker_id
    } else {
        requested_satker_id
    };

    let hash_password =
        hash_password(&payload.password).map_err(|e| HttpError::bad_request(e.to_string()))?;

    // Default role is MEMBER if omitted
    let target_role = payload.role.unwrap_or(crate::auth::rbac::UserRole::Member);

    // SATKER_ADMIN may NOT create SATKER_ADMIN users.
    if !user_claims.user_claims.role.can_create_user_role(target_role) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    app_state
        .db_client
        .create_user(
            satker_id,
            rank_id,
            payload.nrp,
            payload.full_name,
            Some(payload.email),
            payload.phone,
            target_role,
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

    // SATKER_ADMIN can only update users within their satker.
    if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin {
        let target = app_state
            .db_client
            .find_user_by_id(id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
            .ok_or(HttpError::bad_request("User not found"))?;
        if target.satker_id != user_claims.user_claims.satker_id {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }


    app_state
        .db_client
        .update_user(
            id,
            payload.satker_id,
            payload.rank_id,
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

    // SATKER_ADMIN can only delete users within their satker.
    if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin {
        let target = app_state
            .db_client
            .find_user_by_id(id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
            .ok_or(HttpError::bad_request("User not found"))?;
        if target.satker_id != user_claims.user_claims.satker_id {
            return Err(HttpError::unauthorized("forbidden"));
        }
        // also forbid deleting SATKER_ADMIN users from SATKER_ADMIN
        if target.role == crate::auth::rbac::UserRole::SatkerAdmin {
            return Err(HttpError::unauthorized("forbidden"));
        }
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
