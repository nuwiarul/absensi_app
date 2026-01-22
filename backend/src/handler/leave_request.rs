use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::constants::{LeaveStatus, LeaveType};
use crate::database::leave_request::LeaveRequestRepo;
use crate::database::satker::SatkerRepo;
use crate::database::satker_head::SatkerHeadRepo;
use crate::dtos::leave_request::{CreateLeaveDto, CreateLeaveReq, CreateLeaveResp, DecisionLeaveReq, LeaveRequestsResp, ListLeaveAdminQuery, ListMyLeaveQuery, ListPendingLeaveQuery, PendingLeaveDto, PendingLeaveResp, QuickApproveLeaveReq};
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
use crate::database::rank::RankRepo;
use crate::database::user::UserRepo;
use crate::dtos::SuccessResponse;

pub fn leave_request_handler() -> Router {
    Router::new()
        .route("/create", post(create_leave))
        .route("/mine", get(list_my_leaves))
        .route("/", get(list_all_leaves))
        .route("/pending", get(list_pending_leaves))
        .route("/decided", get(list_decided_leaves))
        .route("/{id}/approve", post(approve_leave))
        .route("/{id}/reject", post(reject_leave))
        .route("/{id}/cancel", post(cancel_leave))
        .route("/quick-approve", post(quick_approve_leave))
}

pub async fn cancel_leave(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    // sesuai permintaan: hanya MEMBER yang bisa membatalkan
    if user_claims.user_claims.role != UserRole::Member {
        return Err(HttpError::unauthorized("Forbidden, hanya MEMBER yang bisa membatalkan ijin"));
    }

    let affected = app_state
        .db_client
        .cancel_leave_request_by_user(id, user_claims.user_claims.user_id, None)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if affected == 0 {
        return Err(HttpError::bad_request(
            "Ijin tidak ditemukan / bukan milik anda / status bukan SUBMITTED".to_string(),
        ));
    }

    let response = SuccessResponse {
        status: "200".to_string(),
        data: "Success cancel ijin".to_string(),
    };

    Ok(Json(response))
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

    let ranks = app_state.db_client
        .list_ranks()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let user_dto = UserDto::to_row_dto(&user_claims.user, &user_claims.satker, &ranks);

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

    let mut rows = app_state
        .db_client
        .list_leave_request_by_user_from_to(
            user_claims.user_claims.user_id,
            query_params.from,
            query_params.to,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Optional status filter (handled server-side to match mobile filter)
    if let Some(status_str) = query_params.status.clone().filter(|s| !s.trim().is_empty()) {
        let st = status_str
            .parse::<LeaveStatus>()
            .map_err(|_| HttpError::bad_request("status ijin invalid".to_string()))?;
        rows.retain(|r| r.status == st);
    }

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

    let mut rows = if user_claims.user_claims.role == UserRole::Superadmin {
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

    if let Some(status_str) = query_params.status.clone().filter(|s| !s.trim().is_empty()) {
        let st = status_str
            .parse::<LeaveStatus>()
            .map_err(|_| HttpError::bad_request("status ijin invalid".to_string()))?;
        rows.retain(|r| r.status == st);
    }


    let response = LeaveRequestsResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response))
}

pub async fn list_decided_leaves(
    Query(query_params): Query<ListLeaveAdminQuery>,
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
        if let Some(satker_id) = query_params.satker_id {
            app_state
                .db_client
                .list_decided_leave_request_by_satker_from_to(satker_id, query_params.from, query_params.to)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?
        } else {
            app_state
                .db_client
                .list_decided_leave_request_all_from_to(query_params.from, query_params.to)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?
        }
    } else {
        // Non-superadmin hanya boleh melihat satker sendiri (abaikan query satker_id dari client)
        app_state
            .db_client
            .list_decided_leave_request_by_satker_from_to(
                user_claims.user_claims.satker_id,
                query_params.from,
                query_params.to,
            )
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    };

    let response = LeaveRequestsResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response))
}

pub async fn list_pending_leaves(
    Query(query_params): Query<ListPendingLeaveQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    if !user_claims.user_claims.role.can_approve_leave() {
        return Err(HttpError::unauthorized(
            "Forbidden, anda tidak berhak akses request ini",
        ));
    }

    // ✅ SATKER_ADMIN boleh approve/reject tanpa harus menjadi kepala satker.
    // ✅ SATKER_HEAD hanya boleh jika memang kepala satker yang aktif.
    if matches!(user_claims.user_claims.role, UserRole::SatkerHead) {
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
        if let Some(satker_id) = query_params.satker_id {
            app_state
                .db_client
                .list_pending_leave_by_satker(satker_id)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?
        } else {
            app_state
                .db_client
                .list_pending_leave_all()
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?
        }
    } else {
        // Non-superadmin hanya boleh melihat satker sendiri (abaikan query satker_id dari client)
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


/*pub async fn list_decided_leaves(
    Query(query_params): Query<ListLeaveAdminQuery>,
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
            .list_decided_leave_request_all_from_to(query_params.from, query_params.to)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    } else {
        app_state
            .db_client
            .list_decided_leave_request_by_satker_from_to(
                user_claims.user_claims.satker_id,
                query_params.from,
                query_params.to,
            )
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    };

    let response = LeaveRequestsResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response))
}


pub async fn list_pending_leaves(
    Query(query_params): Query<ListPendingLeaveQuery>,
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
*/
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

pub async fn quick_approve_leave(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<QuickApproveLeaveReq>,
) -> Result<impl IntoResponse, HttpError> {

    payload.validate().map_err(|e| HttpError::bad_request(e.to_string()))?;

    if !user_claims.user_claims.role.can_approve_leave() {
        return Err(HttpError::unauthorized("Forbidden, anda tidak berhak akses request ini"));
    }

    let leave_type = payload.leave_type.parse::<LeaveType>()
        .map_err(|_| HttpError::bad_request("tipe ijin invalid".to_string()))?;

    // Restrict sesuai kebutuhan tukin quick-approve
    if !matches!(leave_type, LeaveType::DinasLuar | LeaveType::Ijin | LeaveType::Sakit) {
        return Err(HttpError::bad_request("Quick approve hanya untuk DINAS_LUAR/IJIN/SAKIT".to_string()));
    }

    // Cari user target + satker
    let target_user = if user_claims.user_claims.role == UserRole::Superadmin {
        app_state.db_client
            .find_user_by_id(payload.user_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    } else {
        // non-superadmin wajib satker sama
        app_state.db_client
            .find_user_by_satker(payload.user_id, user_claims.user_claims.satker_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    }.ok_or(HttpError::bad_request("User tidak ditemukan".to_string()))?;

    // Cek sudah ada APPROVED overlap di tanggal itu?
    let exists = sqlx::query_scalar!(
        r#"
        SELECT 1 as "one!"
        FROM leave_requests
        WHERE user_id = $1
          AND status = 'APPROVED'
          AND start_date <= $2
          AND end_date >= $2
        LIMIT 1
        "#,
        target_user.id,
        payload.work_date
    )
        .fetch_optional(&app_state.db_client.pool)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .is_some();

    if exists {
        return Err(HttpError::bad_request("Sudah ada leave APPROVED pada tanggal tersebut".to_string()));
    }

    // Create leave request (SUBMITTED)
    let row = app_state.db_client
        .create_leave_request(
            target_user.satker_id,
            target_user.id,
            leave_type,
            payload.work_date,
            payload.work_date,
            None, // reason: kosong, karena auto dari edit absensi
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Approve langsung + simpan note (decision_note)
    app_state.db_client
        .approve_or_reject_leave(
            row.id,
            user_claims.user_claims.user_id,
            LeaveStatus::Approved,
            payload.note.map(|s| s.trim().to_string()).filter(|s| !s.is_empty()),
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Leave berhasil di-approve (auto)".to_string(),
    }))
}
