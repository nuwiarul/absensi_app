use std::sync::Arc;

use axum::extract::Query;
use axum::response::IntoResponse;
use axum::routing::get;
use axum::{Extension, Json, Router};

use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::dtos::dashboard::{
    AttendanceCountsQuery, AttendanceCountsResp, SatkerAttendanceCountRow,
};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;

pub fn dashboard_handler() -> Router {
    Router::new().route("/attendance-counts", get(attendance_counts))
}

pub async fn attendance_counts(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Query(q): Query<AttendanceCountsQuery>,
) -> Result<impl IntoResponse, HttpError> {
    let role = user_claims.user_claims.role;
    let satker_id = user_claims.user_claims.satker_id;

    let filter_satker = match role {
        UserRole::Superadmin => None,
        UserRole::SatkerAdmin => Some(satker_id),
        _ => return Err(HttpError::unauthorized("forbidden")),
    };

    // Aggregate: checked-in distinct users for the date, plus total active users per satker.
    // Note: we exclude SUPERADMIN from totals to avoid skewing attendance stats.
    let rows = sqlx::query!(
        r#"
        WITH checked AS (
            SELECT s.work_date, u.satker_id, COUNT(DISTINCT s.user_id)::bigint AS checked_in_count
            FROM attendance_sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.work_date = $1
              AND s.check_in_at IS NOT NULL
              AND u.is_active = TRUE
              AND u.role NOT IN ('SUPERADMIN', 'SATKER_ADMIN')
            GROUP BY s.work_date, u.satker_id
        ), totals AS (
            SELECT satker_id, COUNT(*)::bigint AS total_users
            FROM users
            WHERE is_active = TRUE
              AND role NOT IN ('SUPERADMIN', 'SATKER_ADMIN')
            GROUP BY satker_id
        )
        SELECT
            s.id AS satker_id,
            s.code AS satker_code,
            s.name AS satker_name,
            COALESCE(c.checked_in_count, 0)::bigint AS checked_in_count,
            COALESCE(t.total_users, 0)::bigint AS total_users
        FROM satkers s
        LEFT JOIN checked c ON c.satker_id = s.id
        LEFT JOIN totals t ON t.satker_id = s.id
        WHERE s.is_active = TRUE
          AND s.id <> '11111111-1111-1111-1111-111111111111'::uuid
          AND s.code <> '111111'
          AND ($2::uuid IS NULL OR s.id = $2)
        ORDER BY s.code ASC
        "#,
        q.date,
        filter_satker
    )
    .fetch_all(&app_state.db_client.pool)
    .await
    .map_err(|e| HttpError::server_error(e.to_string()))?;

    let data: Vec<SatkerAttendanceCountRow> = rows
        .into_iter()
        .map(|r| {
            let present_pct = if r.total_users.unwrap_or(0) > 0 {
                let pct = (r.checked_in_count.unwrap_or(0) as f64)
                    / (r.total_users.unwrap_or(0) as f64)
                    * 100.0;
                // two decimals
                (pct * 100.0).round() / 100.0
            } else {
                0.0
            };
            SatkerAttendanceCountRow {
                satker_id: r.satker_id,
                satker_code: r.satker_code,
                satker_name: r.satker_name,
                checked_in_count: r.checked_in_count.unwrap_or(0),
                total_users: r.total_users.unwrap_or(0),
                present_pct,
            }
        })
        .collect();

    Ok(Json(AttendanceCountsResp {
        status: "200".to_string(),
        data,
    }))
}
