use crate::AppState;
use crate::database::satker::SatkerRepo;
use crate::database::user::UserRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::user::{CreateUserReq, UpdateUserReq, UpdateMyProfileReq, ChangeMyPasswordReq, AdminSetPasswordReq, UserDto, UserResp, UsersResp};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::utils::password::{hash_password, compare_password};
use axum::extract::{Path, Multipart};
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use std::sync::Arc;
use chrono::{Datelike, Utc};
use std::path::PathBuf;
use tokio::{fs, io::AsyncWriteExt};

use uuid::Uuid;
use validator::Validate;
use crate::constants::{SUPERUSER_SATKER_ID, SUPERUSER_USER_ID};

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

const MAX_PROFILE_PHOTO_BYTES: usize = 2 * 1024 * 1024; // 2MB

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

    let satkers = app_state
        .db_client
        .get_satker_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let user_dto = UserDto::to_row_with_satker(&user, &satkers);

    Ok(Json(UserResp { status: "200", data: user_dto }))
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
        .update_my_profile(user_claims.user_claims.user_id, payload.full_name, payload.phone)
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
        return Err(HttpError::bad_request("password lama tidak sesuai".to_string()));
    }

    let hash = hash_password(&payload.password)
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

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

async fn save_profile_photo(
    app_state: &AppState,
    user_id: Uuid,
    mut mp: Multipart,
) -> Result<String, HttpError> {
    let now = Utc::now();
    let date_path = format!("{:04}/{:02}/{:02}", now.year(), now.month(), now.day());

    let base_dir: PathBuf = app_state.upload_dir.join("profiles").join(date_path);
    fs::create_dir_all(&base_dir)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let file_id = Uuid::new_v4();

    let mut saved_path: Option<PathBuf> = None;

    while let Some(field) = mp
        .next_field()
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?
    {
        let name = field.name().unwrap_or("").to_string();
        if name != "file" {
            continue;
        }

        let mut ext = "jpg";
        if let Some(ct) = field.content_type() {
            let ok = ct == "image/jpeg" || ct == "image/jpg" || ct == "image/png";
            if !ok {
                return Err(HttpError::bad_request("file harus jpg/png".to_string()));
            }
            if ct == "image/png" {
                ext = "png";
            }
        }

        let filename = format!("{}_{}.{}", user_id, file_id, ext);
        let full_path = base_dir.join(&filename);

        let mut f = fs::File::create(&full_path)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let mut total: usize = 0;
        let mut field = field;
        while let Some(chunk) = field
            .chunk()
            .await
            .map_err(|e| HttpError::bad_request(e.to_string()))?
        {
            total += chunk.len();
            if total > MAX_PROFILE_PHOTO_BYTES {
                let _ = fs::remove_file(&full_path).await;
                return Err(HttpError::bad_request(
                    "file terlalu besar (max 2MB)".to_string(),
                ));
            }
            f.write_all(&chunk)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?;
        }

        f.flush()
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        saved_path = Some(full_path);
        break;
    }

    let full_path = saved_path.ok_or(HttpError::bad_request("part file wajib".to_string()))?;

    let rel = full_path
        .strip_prefix(&app_state.upload_dir)
        .unwrap_or(&full_path)
        .to_string_lossy()
        .replace('\\', "/");

    Ok(format!("local://{}", rel))
}

pub async fn upload_my_photo(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    mp: Multipart,
) -> Result<impl IntoResponse, HttpError> {
    let key = save_profile_photo(&app_state, user_claims.user_claims.user_id, mp).await?;

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
    if user_claims.user_claims.role.can_manage_satker_users() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let target = app_state
        .db_client
        .find_user_by_id(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or(HttpError::bad_request("User not found"))?;

    // SATKER_ADMIN restriction
    if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin {
        if target.satker_id != user_claims.user_claims.satker_id {
            return Err(HttpError::unauthorized("forbidden"));
        }
        // forbid changing SUPERADMIN
        if target.role == crate::auth::rbac::UserRole::Superadmin {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }

    let hash = hash_password(&payload.password)
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

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
    if user_claims.user_claims.role.can_manage_satker_users() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let target = app_state
        .db_client
        .find_user_by_id(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or(HttpError::bad_request("User not found"))?;

    if user_claims.user_claims.role == crate::auth::rbac::UserRole::SatkerAdmin {
        if target.satker_id != user_claims.user_claims.satker_id {
            return Err(HttpError::unauthorized("forbidden"));
        }
        if target.role == crate::auth::rbac::UserRole::Superadmin {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }

    let key = save_profile_photo(&app_state, id, mp).await?;

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


/*use crate::AppState;
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
*/