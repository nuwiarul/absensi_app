use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::constants::LeaveType;
use crate::database::geofence::GeofenceRepo;
use crate::database::satker::SatkerRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::geofence::{CreateGeofenceReq, GeofenceDto, GeofencesResp, UpdateGeofenceReq, can_manage_geofence, can_view_geofence, GeofenceResp};
use crate::dtos::leave_request::{CreateLeaveDto, CreateLeaveReq};
use crate::dtos::satker::SatkerDto;
use crate::dtos::user::UserDto;
use crate::error::{ErrorMessage, HttpError};
use crate::middleware::auth_middleware::AuthMiddleware;
use axum::extract::Path;
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

pub fn geofence_handler() -> Router {
    Router::new()
        .route("/create/{satker_id}", post(create_geofence))
        .route("/update/{id}", put(update_geofence))
        .route("/delete/{id}", delete(delete_geofence))
        .route("/", get(list_geofence))
        .route("/{id}", get(find_geofence))
}

pub async fn create_geofence(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(satker_id): Path<Uuid>,
    Json(payload): Json<CreateGeofenceReq>,
) -> Result<impl IntoResponse, HttpError> {
    if !can_manage_geofence(&user_claims.user_claims, satker_id) {
        return Err(HttpError::unauthorized(
            ErrorMessage::ForbiddenRequest.to_string(),
        ));
    }
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    app_state
        .db_client
        .create_geofence(
            satker_id,
            payload.name,
            payload.latitude,
            payload.longitude,
            payload.radius_meters,
            Some(true),
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let response = SuccessResponse {
        status: "200".to_string(),
        data: "Successfully created geofence".to_string(),
    };

    Ok(Json(response))
}

pub async fn update_geofence(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGeofenceReq>,
) -> Result<impl IntoResponse, HttpError> {
    if !can_manage_geofence(&user_claims.user_claims, user_claims.user_claims.satker_id) {
        return Err(HttpError::unauthorized(
            ErrorMessage::ForbiddenRequest.to_string(),
        ));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    app_state
        .db_client
        .update_geofence(
            id,
            payload.name,
            payload.latitude,
            payload.longitude,
            payload.radius_meters,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let response = SuccessResponse {
        status: "200".to_string(),
        data: "Successfully updated geofence".to_string(),
    };

    Ok(Json(response))
}

pub async fn delete_geofence(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if !can_manage_geofence(&user_claims.user_claims, user_claims.user_claims.satker_id) {
        return Err(HttpError::unauthorized(
            ErrorMessage::ForbiddenRequest.to_string(),
        ));
    }

    app_state
        .db_client
        .delete_geofence(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let response = SuccessResponse {
        status: "200".to_string(),
        data: "Successfully deleted geofence".to_string(),
    };

    Ok(Json(response))
}

pub async fn list_geofence(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    if !can_view_geofence(&user_claims.user_claims, user_claims.user_claims.satker_id) {
        return Err(HttpError::unauthorized(
            ErrorMessage::ForbiddenRequest.to_string(),
        ));
    }

    let rows = if user_claims.user_claims.role == UserRole::Superadmin {
        app_state
            .db_client
            .list_geofences()
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    } else {
        app_state
            .db_client
            .list_geofences_by_satker(user_claims.user_claims.satker_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    };

    let satkers = app_state
        .db_client
        .get_satker_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let geofences_dto = GeofenceDto::to_rows_with_satker(&rows, &satkers);

    let response = GeofencesResp {
        status: "200",
        data: geofences_dto,
    };

    Ok(Json(response))
}

pub async fn find_geofence(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if !can_view_geofence(&user_claims.user_claims, user_claims.user_claims.satker_id) {
        return Err(HttpError::unauthorized(
            ErrorMessage::ForbiddenRequest.to_string(),
        ));
    }

    let row = app_state
        .db_client
        .find_geofence(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let row = row.ok_or(HttpError::bad_request("Geofence not found.".to_string()))?;

    if !user_claims.user_claims.role.is_admin() {
        if row.satker_id != user_claims.user_claims.satker_id {
            return Err(HttpError::bad_request("Anda berada di satker yang salah".to_string()));
        }
    }

    let satker = app_state
    .db_client
    .find_satker_by_id(row.satker_id)
    .await
    .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satker = satker.ok_or(HttpError::bad_request("Satker not found.".to_string()))?;

    let geofence_dto = GeofenceDto::to_row_dto(&row, &satker);

    let response = GeofenceResp {
        status: "200",
        data: geofence_dto,
    };

    Ok(Json(response))
}
