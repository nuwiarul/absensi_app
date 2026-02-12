use crate::AppState;
use crate::database::user::UserRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::user::{
    AdminSetPasswordReq, ChangeMyPasswordReq, CreateUserReq, UpdateMyProfileReq, UpdateUserReq,
    UserDto, UserResp, UsersResp,
};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::services::catalog::load_satkers_and_ranks;
use crate::services::upload::save_profile_photo_upload;
use crate::services::user::{
    ensure_can_manage_satker_users, ensure_same_satker_for_admin, fetch_manageable_user,
};
use crate::utils::password::{compare_password, hash_password};
use axum::extract::{Multipart, Path};
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use std::sync::Arc;

use crate::constants::SUPERUSER_USER_ID;
use uuid::Uuid;
use validator::Validate;

pub fn user_handler() -> Router {
    Router::new()
        // self-service
        .route("/me", get(get_me))
        .route("/me/profile", put(update_my_profile))
        .route("/me/password", post(change_my_password))
        .route("/me/photo", post(upload_my_photo))
        // admin actions
        .route("/{id}/password", post(admin_set_password))
        .route("/{id}/photo", post(admin_upload_photo))
        // existing CRUD
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
    ensure_can_manage_satker_users(&user_claims.user_claims)?;

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

    ensure_same_satker_for_admin(&user_claims.user_claims, requested_satker_id)?;
    let satker_id = if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin {
        user_claims.user_claims.satker_id
    } else {
        requested_satker_id
    };

    let hash_password =
        hash_password(&payload.password).map_err(|e| HttpError::bad_request(e.to_string()))?;

    // Default role is MEMBER if omitted
    let target_role = payload.role.unwrap_or(crate::auth::rbac::UserRole::Member);

    // SATKER_ADMIN may NOT create SATKER_ADMIN users.
    if !user_claims
        .user_claims
        .role
        .can_create_user_role(target_role)
    {
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
    let _ = fetch_manageable_user(&app_state.db_client, &user_claims.user_claims, id).await?;

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
    if id == SUPERUSER_USER_ID {
        return Err(HttpError::bad_request(
            "forbidden, superuser tidak boleh di hapus".to_string(),
        ));
    }

    let target = fetch_manageable_user(&app_state.db_client, &user_claims.user_claims, id).await?;

    if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin
        && target.role == crate::auth::rbac::UserRole::SatkerAdmin
    {
        return Err(HttpError::unauthorized("forbidden"));
    }

    app_state
        .db_client
        .delete_user(id)
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

    let (satkers, ranks) = load_satkers_and_ranks(&app_state.db_client).await?;
    let users_dto = UserDto::to_rows_with_satker(&users, &satkers, &ranks);

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

    let (satkers, ranks) = load_satkers_and_ranks(&app_state.db_client).await?;
    let users_dto = UserDto::to_rows_with_satker(&users, &satkers, &ranks);

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

    let (satkers, ranks) = load_satkers_and_ranks(&app_state.db_client).await?;
    let user_dto = UserDto::to_row_with_satker(&user, &satkers, &ranks);

    Ok(Json(UserResp {
        status: "200",
        data: user_dto,
    }))
}

pub async fn get_me(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let id = user_claims.user_claims.user_id;
    let row = app_state
        .db_client
        .find_user_by_id(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let user = row.ok_or(HttpError::bad_request("User not found"))?;

    let (satkers, ranks) = load_satkers_and_ranks(&app_state.db_client).await?;
    let user_dto = UserDto::to_row_with_satker(&user, &satkers, &ranks);

    Ok(Json(UserResp {
        status: "200",
        data: user_dto,
    }))
}

pub async fn update_my_profile(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<UpdateMyProfileReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    app_state
        .db_client
        .update_my_profile(
            user_claims.user_claims.user_id,
            payload.full_name,
            payload.phone,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully updated profile".to_string(),
    }))
}

pub async fn change_my_password(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<ChangeMyPasswordReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let id = user_claims.user_claims.user_id;
    let row = app_state
        .db_client
        .find_user_by_id(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let user = row.ok_or(HttpError::bad_request("User not found"))?;

    let ok = compare_password(&payload.old_password, &user.password_hash)
        .map_err(|e| HttpError::bad_request(e.to_string()))?;
    if !ok {
        return Err(HttpError::bad_request(
            "password lama tidak sesuai".to_string(),
        ));
    }

    let hash =
        hash_password(&payload.password).map_err(|e| HttpError::bad_request(e.to_string()))?;

    app_state
        .db_client
        .update_password_hash(id, hash)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully changed password".to_string(),
    }))
}

pub async fn upload_my_photo(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    mp: Multipart,
) -> Result<impl IntoResponse, HttpError> {
    let key = save_profile_photo_upload(&app_state.upload_dir, user_claims.user_claims.user_id, mp)
        .await?;

    app_state
        .db_client
        .update_profile_photo_key(user_claims.user_claims.user_id, Some(key.clone()))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: key,
    }))
}

pub async fn admin_set_password(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<AdminSetPasswordReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let target = fetch_manageable_user(&app_state.db_client, &user_claims.user_claims, id).await?;

    if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin
        && target.role == crate::auth::rbac::UserRole::Superadmin
    {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let hash =
        hash_password(&payload.password).map_err(|e| HttpError::bad_request(e.to_string()))?;

    app_state
        .db_client
        .update_password_hash(id, hash)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully set password".to_string(),
    }))
}

pub async fn admin_upload_photo(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    mp: Multipart,
) -> Result<impl IntoResponse, HttpError> {
    let target = fetch_manageable_user(&app_state.db_client, &user_claims.user_claims, id).await?;

    if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin
        && target.role == crate::auth::rbac::UserRole::Superadmin
    {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let key = save_profile_photo_upload(&app_state.upload_dir, id, mp).await?;

    app_state
        .db_client
        .update_profile_photo_key(id, Some(key.clone()))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: key,
    }))
}
