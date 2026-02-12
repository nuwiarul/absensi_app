use crate::auth::rbac::UserRole;
use crate::constants::LeaveStatus;
use crate::dtos::leave_request::LeaveRequestDto;
use crate::error::HttpError;
use uuid::Uuid;

/// Resolves the effective satker filter for admin list queries.
pub fn resolve_admin_satker_filter(
    role: UserRole,
    user_satker_id: Uuid,
    requested_satker_id: Option<Uuid>,
) -> Option<Uuid> {
    if role == UserRole::Superadmin {
        requested_satker_id
    } else {
        Some(user_satker_id)
    }
}

/// Parses the optional status filter used in leave list endpoints.
pub fn parse_status_filter(status: Option<String>) -> Result<Option<LeaveStatus>, HttpError> {
    let Some(status_str) = status.filter(|s| !s.trim().is_empty()) else {
        return Ok(None);
    };

    let parsed = status_str
        .parse::<LeaveStatus>()
        .map_err(|_| HttpError::bad_request("status ijin invalid".to_string()))?;

    Ok(Some(parsed))
}

/// Applies the status filter to the leave request list.
pub fn apply_status_filter(rows: &mut Vec<LeaveRequestDto>, status: Option<LeaveStatus>) {
    if let Some(st) = status {
        rows.retain(|r| r.status == st);
    }
}
