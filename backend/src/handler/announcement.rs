use axum::{Extension, Json, Router};
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{get, post, put, delete};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::database::announcement::AnnouncementRepo;
use crate::dtos::announcement::{CreateAnnouncementReq, UpdateAnnouncementReq};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;

#[derive(Debug, Deserialize)]
struct ListManageQuery {
    include_inactive: Option<bool>,
}

pub fn announcement_handler() -> Router {
    Router::new()
        // Visible for any authenticated user (mobile/web)
        .route("/", get(list_visible))
        // Management (admin web)
        .route("/admin", get(list_manageable))
        .route("/", post(create))
        .route("/{id}", put(update))
        .route("/{id}", delete(deactivate))
}

async fn list_visible(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(auth): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let rows = app_state
        .db_client
        .list_visible_announcements(auth.user_claims.satker_id)
        .await
        .map_err(|_| HttpError::server_error("Server error".to_string()))?;

    Ok(Json(json!({ "status": "success", "data": rows })))
}

async fn list_manageable(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(auth): Extension<AuthMiddleware>,
    Query(_q): Query<ListManageQuery>,
) -> Result<impl IntoResponse, HttpError> {
    // Allow admins & heads to view list, but only admins can create/update.
    if !matches!(auth.user_claims.role, UserRole::Superadmin | UserRole::SatkerAdmin | UserRole::SatkerHead) {
        return Err(HttpError::unauthorized("Unauthorized".to_string()));
    }

    let is_superadmin = matches!(auth.user_claims.role, UserRole::Superadmin);
    let rows = app_state
        .db_client
        .list_manageable_announcements(is_superadmin, auth.user_claims.satker_id)
        .await
        .map_err(|_| HttpError::server_error("Server error".to_string()))?;

    Ok(Json(json!({ "status": "success", "data": rows })))
}

async fn create(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(auth): Extension<AuthMiddleware>,
    Json(mut req): Json<CreateAnnouncementReq>,
) -> Result<impl IntoResponse, HttpError> {
    // Only SUPERADMIN / SATKER_ADMIN can create
    if !auth.user_claims.role.is_admin() {
        return Err(HttpError::unauthorized("Unauthorized".to_string()));
    }

    req.title = req.title.trim().to_string();
    req.body = req.body.trim().to_string();
    if req.title.is_empty() {
        return Err(HttpError::bad_request("Title wajib diisi".to_string()));
    }
    if req.body.is_empty() {
        return Err(HttpError::bad_request("Body wajib diisi".to_string()));
    }

    // Enforce scope rules
    let scope = req.scope.as_str();
    match scope {
        "GLOBAL" => {
            if auth.user_claims.role != UserRole::Superadmin {
                return Err(HttpError::unauthorized("Hanya SUPERADMIN yang bisa membuat pengumuman GLOBAL".to_string()));
            }
            req.satker_id = None;
        }
        "SATKER" => {
            // SATKER_ADMIN can only create for own satker
            if auth.user_claims.role == UserRole::SatkerAdmin {
                req.satker_id = Some(auth.user_claims.satker_id);
            } else {
                // SUPERADMIN: must provide satker_id
                if req.satker_id.is_none() {
                    return Err(HttpError::bad_request("satker_id wajib untuk scope SATKER".to_string()));
                }
            }
        }
        _ => return Err(HttpError::bad_request("scope tidak valid".to_string())),
    }

    let id = app_state
        .db_client
        .create_announcement(auth.user_claims.user_id, req)
        .await
        .map_err(|e| {
            // Most likely constraint errors
            HttpError::bad_request(format!("Gagal membuat pengumuman: {e}"))
        })?;

    Ok(Json(json!({ "status": "success", "data": id.to_string() })))
}

async fn update(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(auth): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(mut req): Json<UpdateAnnouncementReq>,
) -> Result<impl IntoResponse, HttpError> {
    if !auth.user_claims.role.is_admin() {
        return Err(HttpError::unauthorized("Unauthorized".to_string()));
    }

    let existing = app_state
        .db_client
        .find_announcement_by_id(id)
        .await
        .map_err(|_| HttpError::server_error("Server error".to_string()))?;

    let existing = existing.ok_or(HttpError::bad_request("Pengumuman tidak ditemukan".to_string()))?;

    // SATKER_ADMIN can only update SATKER announcements in own satker, not GLOBAL
    if auth.user_claims.role == UserRole::SatkerAdmin {
        if existing.scope == "GLOBAL" {
            return Err(HttpError::unauthorized("SATKER_ADMIN tidak boleh mengubah pengumuman GLOBAL".to_string()));
        }
        if existing.satker_id != Some(auth.user_claims.satker_id) {
            return Err(HttpError::unauthorized("Tidak boleh mengubah pengumuman satker lain".to_string()));
        }
        // Force scope SATKER and satker_id own
        req.scope = Some("SATKER".into());
        req.satker_id = Some(auth.user_claims.satker_id);
    }

    // SUPERADMIN validations
    if let Some(title) = &req.title {
        if title.trim().is_empty() {
            return Err(HttpError::bad_request("Title wajib diisi".to_string()));
        }
        req.title = Some(title.trim().to_string());
    }
    if let Some(body) = &req.body {
        if body.trim().is_empty() {
            return Err(HttpError::bad_request("Body wajib diisi".to_string()));
        }
        req.body = Some(body.trim().to_string());
    }

    // If changing scope, enforce consistency
    if let Some(scope) = &req.scope {
        match scope.as_str() {
            "GLOBAL" => {
                if auth.user_claims.role != UserRole::Superadmin {
                    return Err(HttpError::unauthorized("Hanya SUPERADMIN yang bisa set scope GLOBAL".to_string()));
                }
                req.satker_id = None;
            }
            "SATKER" => {
                if auth.user_claims.role == UserRole::SatkerAdmin {
                    req.satker_id = Some(auth.user_claims.satker_id);
                } else if req.satker_id.is_none() && existing.satker_id.is_none() {
                    return Err(HttpError::bad_request("satker_id wajib untuk scope SATKER"));
                }
            }
            _ => return Err(HttpError::bad_request("scope tidak valid".to_string())),
        }
    }

    app_state
        .db_client
        .update_announcement(id, req)
        .await
        .map_err(|e| HttpError::bad_request(format!("Gagal update: {e}")))?;

    Ok(Json(json!({ "status": "success", "data": "ok" })))
}

async fn deactivate(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(auth): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if !auth.user_claims.role.is_admin() {
        return Err(HttpError::unauthorized("Unauthorized".to_string()));
    }

    let existing = app_state
        .db_client
        .find_announcement_by_id(id)
        .await
        .map_err(|_| HttpError::server_error("Server error".to_string()))?;

    let existing = existing.ok_or(HttpError::bad_request("Pengumuman tidak ditemukan".to_string()))?;

    if auth.user_claims.role == UserRole::SatkerAdmin {
        if existing.scope == "GLOBAL" {
            return Err(HttpError::unauthorized("SATKER_ADMIN tidak boleh menghapus pengumuman GLOBAL".to_string()));
        }
        if existing.satker_id != Some(auth.user_claims.satker_id) {
            return Err(HttpError::unauthorized("Tidak boleh menghapus pengumuman satker lain".to_string()));
        }
    }

    app_state
        .db_client
        .deactivate_announcement(id)
        .await
        .map_err(|_| HttpError::server_error("Server error".to_string()))?;

    Ok(Json(json!({ "status": "success", "data": "ok" })))
}
