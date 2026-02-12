use crate::auth::rbac::UserRole;
use crate::database::user::UserRepo;
use crate::db::DBClient;
use crate::error::HttpError;
use crate::middleware::auth_middleware::UserClaims;
use crate::models::User;
use uuid::Uuid;

/// Ensures the caller has the rights to manage satker users.
pub fn ensure_can_manage_satker_users(claims: &UserClaims) -> Result<(), HttpError> {
    if claims.role.can_manage_satker_users() {
        Ok(())
    } else {
        Err(HttpError::unauthorized("forbidden".to_string()))
    }
}

/// Ensures SATKER_ADMIN only operates within their own satker.
pub fn ensure_same_satker_for_admin(
    claims: &UserClaims,
    target_satker_id: Uuid,
) -> Result<(), HttpError> {
    if claims.role == UserRole::SatkerAdmin && claims.satker_id != target_satker_id {
        Err(HttpError::unauthorized("forbidden".to_string()))
    } else {
        Ok(())
    }
}

/// Loads a user that the caller is allowed to manage, returning an error otherwise.
pub async fn fetch_manageable_user(
    db_client: &DBClient,
    claims: &UserClaims,
    user_id: Uuid,
) -> Result<User, HttpError> {
    ensure_can_manage_satker_users(claims)?;

    let target = db_client
        .find_user_by_id(user_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .ok_or(HttpError::bad_request("User not found"))?;

    ensure_same_satker_for_admin(claims, target.satker_id)?;

    Ok(target)
}
