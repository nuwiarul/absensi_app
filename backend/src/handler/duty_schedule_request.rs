use axum::{Extension, Json, Router};
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use chrono::{DateTime, Utc, Datelike, TimeZone};
use chrono_tz::Tz;
use std::str::FromStr;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::database::duty_schedule::DutyScheduleRepo;
use crate::database::duty_schedule_request::DutyScheduleRequestRepo;
use crate::database::satker_head::SatkerHeadRepo;
use crate::database::settings::SettingsRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::duty_schedule::can_manage_duty_schedules;
use crate::dtos::duty_schedule_request::{
    CreateDutyScheduleRequestReq, DutyScheduleRequestsResp, ListDutyScheduleRequestsQuery,
    RejectDutyScheduleRequestReq,
};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;

pub fn duty_schedule_request_handler() -> Router {
    Router::new()
        .route("/", get(list_requests).post(create_request))
        .route("/{id}/cancel", put(cancel_request))
        .route("/{id}/approve", put(approve_request))
        .route("/{id}/reject", put(reject_request))
}

fn normalize_status(s: Option<String>) -> Option<String> {
    s.map(|v| v.trim().to_uppercase())
}

async fn get_app_timezone(app_state: &Arc<AppState>) -> Result<Tz, HttpError> {
    let tz_value = app_state
        .db_client
        .get_timezone_value()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    Ok(Tz::from_str(&tz_value).unwrap_or(chrono_tz::Asia::Jakarta))
}

/// RULE: start_at tidak boleh tanggal sebelum hari ini (berdasarkan timezone app).
/// Boleh jam sebelum jam sekarang di hari yang sama.
fn validate_start_date_not_before_today(start_at: DateTime<Utc>, tz: Tz) -> Result<(), HttpError> {
    let start_local = start_at.with_timezone(&tz);
    let today = Utc::now().with_timezone(&tz).date_naive();
    if start_local.date_naive() < today {
        return Err(HttpError::bad_request(
            "Tanggal mulai tidak boleh sebelum hari ini".to_string(),
        ));
    }
    Ok(())
}

fn validate_duration_max_24h(start_at: DateTime<Utc>, end_at: DateTime<Utc>) -> Result<(), HttpError> {
    if end_at <= start_at {
        return Err(HttpError::bad_request(
            "end_at harus lebih besar dari start_at".to_string(),
        ));
    }
    let dur = end_at - start_at;
    if dur.num_seconds() > 24 * 60 * 60 {
        return Err(HttpError::bad_request(
            "Durasi jadwal dinas tidak boleh lebih dari 24 jam".to_string(),
        ));
    }
    Ok(())
}

pub async fn list_requests(
    Query(query): Query<ListDutyScheduleRequestsQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    // Default range: current month start -> next month start (exclusive) (UTC).
    let now = Utc::now();
    let from = query.from.unwrap_or_else(|| {
        Utc.with_ymd_and_hms(now.year(), now.month(), 1, 0, 0, 0)
            .unwrap()
    });

    let to = query.to.unwrap_or_else(|| {
        let (y, m) = if now.month() == 12 { (now.year() + 1, 1) } else { (now.year(), now.month() + 1) };
        Utc.with_ymd_and_hms(y, m, 1, 0, 0, 0).unwrap()
    });

    if to < from {
        return Err(HttpError::bad_request(
            "Tanggal end tidak boleh lebih awal dari tanggal start".to_string(),
        ));
    }

    let mut satker_id = query.satker_id;
    let mut user_id = query.user_id;

    // role scoping
    match user_claims.user_claims.role {
        UserRole::Superadmin => {
            // keep query filters
        }
        UserRole::SatkerAdmin | UserRole::SatkerHead => {
            satker_id = Some(user_claims.user_claims.satker_id);
        }
        UserRole::Member => {
            satker_id = Some(user_claims.user_claims.satker_id);
            user_id = Some(user_claims.user_claims.user_id);
        }
    }

    // satker head must be current head when accessing satker scope (list)
    if user_claims.user_claims.role == UserRole::SatkerHead {
        let ok = app_state
            .db_client
            .is_current_head_satker(user_claims.user_claims.satker_id, user_claims.user_claims.user_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !ok {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }

    let status = normalize_status(query.status).unwrap_or_else(|| "SUBMITTED".to_string());
    let status_ref: Option<&str> = Some(status.as_str());

    let rows = app_state
        .db_client
        .list_duty_schedule_requests(satker_id, user_id, status_ref, from, to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(DutyScheduleRequestsResp { status: "200", data: rows }))
}

pub async fn create_request(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<CreateDutyScheduleRequestReq>,
) -> Result<impl IntoResponse, HttpError> {
    // only MEMBER can request
    if user_claims.user_claims.role != UserRole::Member {
        return Err(HttpError::unauthorized("forbidden"));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(format!("validate error: {}", e)))?;

    validate_duration_max_24h(payload.start_at, payload.end_at)?;

    let tz = get_app_timezone(&app_state).await?;
    validate_start_date_not_before_today(payload.start_at, tz)?;

    let satker_id = user_claims.user_claims.satker_id;
    let user_id = user_claims.user_claims.user_id;

    // overlap check with existing duty schedules
    let has_overlap = app_state
        .db_client
        .has_overlap(user_id, payload.start_at, payload.end_at, None)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    if has_overlap {
        return Err(HttpError::bad_request(
            "Jadwal dinas overlap dengan jadwal dinas yang sudah ada".to_string(),
        ));
    }

    // overlap check with pending submitted requests
    let has_overlap_pending = app_state
        .db_client
        .has_overlap_submitted(satker_id, user_id, payload.start_at, payload.end_at, None)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    if has_overlap_pending {
        return Err(HttpError::bad_request(
            "Jadwal dinas overlap dengan pengajuan jadwal dinas yang masih diproses".to_string(),
        ));
    }

    let _id = app_state
        .db_client
        .create_duty_schedule_request(
            satker_id,
            user_id,
            payload.start_at,
            payload.end_at,
            payload.schedule_type,
            payload.title,
            payload.note,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Successfully submitted duty schedule request".to_string(),
    }))
}

pub async fn cancel_request(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role != UserRole::Member {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let mut tx = app_state
        .db_client
        .pool
        .begin()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let row = sqlx::query!(
        r#"SELECT id, user_id, status FROM duty_schedule_requests WHERE id = $1 FOR UPDATE"#,
        id
    )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or_else(|| HttpError::bad_request("pengajuan jadwal dinas tidak ditemukan".to_string()))?;

    if row.user_id != user_claims.user_claims.user_id {
        return Err(HttpError::unauthorized("forbidden"));
    }
    if row.status != "SUBMITTED" {
        return Err(HttpError::bad_request(
            "hanya pengajuan dengan status SUBMITTED yang bisa dibatalkan".to_string(),
        ));
    }

    sqlx::query!(
        r#"UPDATE duty_schedule_requests SET status = 'CANCELED', updated_at = now() WHERE id = $1"#,
        id
    )
        .execute(&mut *tx)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Successfully canceled duty schedule request".to_string(),
    }))
}

pub async fn approve_request(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    // Only admin roles
    let role = user_claims.user_claims.role;
    if !(role == UserRole::Superadmin || role == UserRole::SatkerAdmin || role == UserRole::SatkerHead) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let mut tx = app_state
        .db_client
        .pool
        .begin()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let req_row = sqlx::query!(
        r#"
        SELECT id, satker_id, user_id, start_at, end_at, schedule_type as "schedule_type: crate::constants::ScheduleType",
               title, note, status
        FROM duty_schedule_requests
        WHERE id = $1
        FOR UPDATE
        "#,
        id
    )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or_else(|| HttpError::bad_request("pengajuan jadwal dinas tidak ditemukan".to_string()))?;

    // scope checks
    if !can_manage_duty_schedules(&user_claims.user_claims, req_row.satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }
    if role == UserRole::SatkerHead {
        let ok = app_state
            .db_client
            .is_current_head_satker(req_row.satker_id, user_claims.user_claims.user_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !ok {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }
    if role != UserRole::Superadmin && user_claims.user_claims.satker_id != req_row.satker_id {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if req_row.status != "SUBMITTED" {
        return Err(HttpError::bad_request(
            "hanya pengajuan dengan status SUBMITTED yang bisa di-approve".to_string(),
        ));
    }

    // Re-validate constraints
    validate_duration_max_24h(req_row.start_at, req_row.end_at)?;
    let tz = get_app_timezone(&app_state).await?;
    validate_start_date_not_before_today(req_row.start_at, tz)?;

    // Check overlap with existing duty schedules (latest state)
    let has_overlap = sqlx::query!(
        r#"
        SELECT 1 as one
        FROM duty_schedules
        WHERE deleted_at IS NULL
          AND user_id = $1
          AND start_at < $3
          AND end_at > $2
        LIMIT 1
        "#,
        req_row.user_id,
        req_row.start_at,
        req_row.end_at
    )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .is_some();

    if has_overlap {
        // auto reject (tidak masuk duty_schedules)
        sqlx::query!(
            r#"
            UPDATE duty_schedule_requests
            SET status = 'REJECTED', reject_reason = $2, decided_by = $3, decided_at = now(), updated_at = now()
            WHERE id = $1
            "#,
            id,
            "Jadwal dinas overlap dengan jadwal dinas yang sudah ada",
            user_claims.user_claims.user_id
        )
            .execute(&mut *tx)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        tx.commit()
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        return Err(HttpError::bad_request(
            "Jadwal dinas overlap dengan jadwal dinas yang sudah ada".to_string(),
        ));
    }

    // Insert into duty_schedules inside the same transaction.
    // created_by MUST be request.user_id (per requirement).
    sqlx::query!(
        r#"
        INSERT INTO duty_schedules (
            satker_id, user_id,
            schedule_date, start_time, end_time,
            start_at, end_at,
            type, title, notes, created_by
        )
        VALUES (
            $1, $2,
            ($3 AT TIME ZONE 'UTC')::date,
            ($3 AT TIME ZONE 'UTC')::time,
            ($4 AT TIME ZONE 'UTC')::time,
            $3, $4,
            $5, $6, $7, $8
        )
        "#,
        req_row.satker_id,
        req_row.user_id,
        req_row.start_at,
        req_row.end_at,
        req_row.schedule_type as crate::constants::ScheduleType,
        req_row.title,
        req_row.note,
        req_row.user_id, // ✅ created_by = pemohon
    )
        .execute(&mut *tx)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    sqlx::query!(
        r#"
        UPDATE duty_schedule_requests
        SET status = 'APPROVED', decided_by = $2, decided_at = now(), updated_at = now()
        WHERE id = $1
        "#,
        id,
        user_claims.user_claims.user_id // admin approver
    )
        .execute(&mut *tx)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Successfully approved duty schedule request".to_string(),
    }))
}

pub async fn reject_request(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<RejectDutyScheduleRequestReq>,
) -> Result<impl IntoResponse, HttpError> {
    let role = user_claims.user_claims.role;
    if !(role == UserRole::Superadmin || role == UserRole::SatkerAdmin || role == UserRole::SatkerHead) {
        return Err(HttpError::unauthorized("forbidden"));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(format!("validate error: {}", e)))?;

    let mut tx = app_state
        .db_client
        .pool
        .begin()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let req_row = sqlx::query!(
        r#"SELECT id, satker_id, status FROM duty_schedule_requests WHERE id = $1 FOR UPDATE"#,
        id
    )
        .fetch_optional(&mut *tx)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or_else(|| HttpError::bad_request("pengajuan jadwal dinas tidak ditemukan".to_string()))?;

    if !can_manage_duty_schedules(&user_claims.user_claims, req_row.satker_id) {
        return Err(HttpError::unauthorized("forbidden"));
    }
    if role == UserRole::SatkerHead {
        let ok = app_state
            .db_client
            .is_current_head_satker(req_row.satker_id, user_claims.user_claims.user_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !ok {
            return Err(HttpError::unauthorized("forbidden"));
        }
    }
    if role != UserRole::Superadmin && user_claims.user_claims.satker_id != req_row.satker_id {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if req_row.status != "SUBMITTED" {
        return Err(HttpError::bad_request(
            "hanya pengajuan dengan status SUBMITTED yang bisa di-reject".to_string(),
        ));
    }

    // reject only updates request table (no insert to duty_schedules)
    sqlx::query!(
        r#"
        UPDATE duty_schedule_requests
        SET status = 'REJECTED', reject_reason = $2, decided_by = $3, decided_at = now(), updated_at = now()
        WHERE id = $1
        "#,
        id,
        payload.reject_reason,
        user_claims.user_claims.user_id
    )
        .execute(&mut *tx)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    tx.commit()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Successfully rejected duty schedule request".to_string(),
    }))
}
