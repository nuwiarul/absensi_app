use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::constants::{LeaveStatus, LeaveType};
use crate::database::leave_request::LeaveRequestRepo;
use crate::database::satker::SatkerRepo;
use crate::database::satker_head::SatkerHeadRepo;
use crate::dtos::leave_request::{CreateLeaveDto, CreateLeaveReq, CreateLeaveResp, DecisionLeaveReq, LeaveRequestsResp, ListMyLeaveQuery, PendingLeaveDto, PendingLeaveResp};
use crate::dtos::satker::{CreateSatkerReq, SatkerDto};
use crate::dtos::user::UserDto;
use crate::error::HttpError;
use crate::middleware::auth_middleware::{AuthMiddleware, UserClaims};
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use std::future::pending;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;
use crate::dtos::SuccessResponse;

pub fn leave_request_handler() -> Router {
    Router::new()
        .route("/create", post(create_leave))
        .route("/mine", get(list_my_leaves))
        .route("/", get(list_all_leaves))
        .route("/pending", get(list_pending_leaves))
        .route("/{id}/approve", post(approve_leave))
        .route("/{id}/reject", post(reject_leave))
}

pub async fn create_leave(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<CreateLeaveReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let leave_type = payload
        .leave_type
        .parse::<LeaveType>()
        .map_err(|_| HttpError::bad_request("tipe ijin invalid".to_string()))?;

    let row = app_state
        .db_client
        .create_leave_request(
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            leave_type,
            payload.start_date,
            payload.end_date,
            payload.reason,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satker_dto = SatkerDto::to_row(&user_claims.satker);
    let user_dto = UserDto::to_row_dto(&user_claims.user, &user_claims.satker);

    let response = CreateLeaveDto {
        id: row.id,
        satker: satker_dto,
        user: user_dto,
        leave_type,
        start_date: row.start_date,
        end_date: row.end_date,
        reason: row.reason,
        status: row.status,
        submitted_at: row.submitted_at,
    };

    Ok(Json(response))
}

pub async fn list_my_leaves(
    Query(query_params): Query<ListMyLeaveQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    query_params
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let rows = app_state
        .db_client
        .list_leave_request_by_user_from_to(
            user_claims.user_claims.user_id,
            query_params.from,
            query_params.to,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let response = LeaveRequestsResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response))
}

pub async fn list_all_leaves(
    Query(query_params): Query<ListMyLeaveQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {

    if !user_claims.user_claims.role.can_view_leave() {
        return Err(HttpError::unauthorized("Anda tidak berhak akses request ini"));
    }

    query_params
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let rows = if user_claims.user_claims.role == UserRole::Superadmin {
        app_state
        .db_client
            .list_leave_request_all_from_to(
                query_params.from,
                query_params.to,
            ).await
        .map_err(|e| HttpError::server_error(e.to_string()))?
    } else {
        app_state
        .db_client
            .list_leave_request_by_satker_from_to(
                user_claims.user_claims.satker_id,
                query_params.from, query_params.to
            ).await
        .map_err(|e| HttpError::server_error(e.to_string()))?

    };


    let response = LeaveRequestsResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response))
}

pub async fn list_pending_leaves(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    if !user_claims.user_claims.role.can_approve_leave() {
        return Err(HttpError::unauthorized(
            "Forbidden, anda tidak berhak akses request ini",
        ));
    }

    if user_claims.user_claims.role != UserRole::Superadmin {
        let ok = app_state
            .db_client
            .is_current_head_satker(
                user_claims.user_claims.satker_id,
                user_claims.user_claims.user_id,
            )
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !ok {
            return Err(HttpError::unauthorized(
                "Forbidden, anda tidak berhak akses request ini",
            ));
        }
    }

    let rows = if user_claims.user_claims.role == UserRole::Superadmin {
        app_state
            .db_client
            .list_pending_leave_all()
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    } else {
        app_state
            .db_client
            .list_pending_leave_by_satker(user_claims.user_claims.satker_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    };

    let response = PendingLeaveResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response))
}

pub async fn approve_leave(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id) : Path<Uuid>,
    Json(payload): Json<DecisionLeaveReq>,
) -> Result<impl IntoResponse, HttpError> {
    decide_leave(
        app_state,
        user_claims.user_claims,
        id,
        true,
        payload.note
    ).await
}

pub async fn reject_leave(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id) : Path<Uuid>,
    Json(payload): Json<DecisionLeaveReq>,
) -> Result<impl IntoResponse, HttpError> {
    decide_leave(
        app_state,
        user_claims.user_claims,
        id,
        false,
        payload.note
    ).await
}

async fn decide_leave(
    app_state: Arc<AppState>,
    user_claims: UserClaims,
    leave_id: Uuid,
    approve: bool,
    note: Option<String>,
) -> Result<impl IntoResponse, HttpError> {

    if !user_claims.role.can_approve_leave() {
        return Err(HttpError::unauthorized("Forbidden, anda tidak berhak akses request ini"));
    }

    let leave = app_state
    .db_client
        .find_leave_request_by_id(leave_id)
    .await
    .map_err(|e| HttpError::server_error(e.to_string()))?;

    let leave = leave.ok_or(HttpError::bad_request("Ijin tidak di temukan".to_string()))?;

    if leave.status != LeaveStatus::Submitted {
        return Err(HttpError::bad_request("Ijin sudah tidak berlaku, lakukan ijin ulang".to_string()));
    }

    if user_claims.role != UserRole::Superadmin {
        if leave.satker_id != user_claims.satker_id {
            return Err(HttpError::bad_request("Anda tidak berhak approve atau reject di satker lain"));
        }

        let ok = app_state
            .db_client
            .is_current_head_satker(
                user_claims.satker_id,
                user_claims.user_id,
            )
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !ok {
            return Err(HttpError::unauthorized(
                "Forbidden, anda tidak berhak akses request ini",
            ));
        }

    }

    let new_status = if approve { LeaveStatus::Approved } else { LeaveStatus::Rejected };

    app_state.db_client
        .approve_or_reject_leave(
            leave.id,
            user_claims.user_id,
            new_status,
            note
        ).await
    .map_err(|e| HttpError::server_error(e.to_string()))?;

    let response = SuccessResponse {
        status: "200".to_string(),
        data: "Success approve or reject ijin".to_string(),
    };

    Ok(Json(response))

}
