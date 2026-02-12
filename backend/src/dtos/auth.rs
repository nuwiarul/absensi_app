use crate::auth::rbac::UserRole;
use crate::models::{Satker, User};
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct LoginReq {
    #[validate(length(min = 4, message = "username di butuhkan"))]
    pub username: String,
    #[validate(length(
        min = 8,
        max = 64,
        message = "password harus di antara 8 sampai 64 karakter."
    ))]
    pub password: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct LoginDto {
    pub id: String,
    pub nrp: String,
    pub full_name: String,
    pub token: String,
    pub satker_id: String,
    pub role: UserRole,
    pub satker_name: String,
    pub satker_code: String,
    pub profile_photo_key: Option<String>,
}

impl LoginDto {
    pub fn to_row(token: String, user: &User, satker: &Satker) -> Self {
        LoginDto {
            id: user.id.to_string(),
            nrp: user.nrp.clone(),
            full_name: user.full_name.clone(),
            satker_id: user.satker_id.to_string(),
            role: user.role,
            satker_name: satker.name.clone(),
            satker_code: satker.code.clone(),
            profile_photo_key: user.profile_photo_key.clone(),
            token,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct LoginResp {
    pub status: &'static str,
    pub data: LoginDto,
}
