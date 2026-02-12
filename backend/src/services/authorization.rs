use crate::auth::rbac::UserRole;
use crate::error::HttpError;
use crate::middleware::auth_middleware::UserClaims;
use uuid::Uuid;

/// Returns true if the caller may operate on the given satker.
pub fn can_access_satker(claims: &UserClaims, target_satker_id: Uuid) -> bool {
    if claims.role == UserRole::Superadmin {
        return true;
    }

    matches!(claims.role, UserRole::SatkerAdmin | UserRole::SatkerHead)
        && claims.satker_id == target_satker_id
}

/// Ensures caller is Superadmin or a SatkerAdmin/SatkerHead in the same satker.
pub fn ensure_can_access_satker(
    claims: &UserClaims,
    target_satker_id: Uuid,
) -> Result<(), HttpError> {
    if can_access_satker(claims, target_satker_id) {
        Ok(())
    } else {
        Err(HttpError::unauthorized("forbidden".to_string()))
    }
}
