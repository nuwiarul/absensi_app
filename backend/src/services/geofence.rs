use crate::auth::rbac::UserRole;
use crate::database::geofence::GeofenceRepo;
use crate::db::DBClient;
use crate::dtos::geofence::can_manage_geofence;
use crate::error::{ErrorMessage, HttpError};
use crate::middleware::auth_middleware::UserClaims;
use uuid::Uuid;

/// Ensures non-superadmin callers can manage the specified geofence.
pub async fn ensure_can_manage_geofence(
    db_client: &DBClient,
    claims: &UserClaims,
    geofence_id: Uuid,
) -> Result<(), HttpError> {
    if claims.role == UserRole::Superadmin {
        return Ok(());
    }

    if !can_manage_geofence(claims, claims.satker_id) {
        return Err(HttpError::unauthorized(
            ErrorMessage::ForbiddenRequest.to_string(),
        ));
    }

    let row = db_client
        .find_geofence(geofence_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let row = row.ok_or(HttpError::bad_request("Geofence not found.".to_string()))?;
    if row.satker_id != claims.satker_id {
        return Err(HttpError::unauthorized(
            ErrorMessage::ForbiddenRequest.to_string(),
        ));
    }

    Ok(())
}
