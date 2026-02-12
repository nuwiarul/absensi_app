use crate::auth::rbac::UserRole;
use crate::dtos::rank::RankDto;
use crate::dtos::satker::SatkerDto;
use crate::models::{Rank, Satker, User};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct CreateUserReq {
    #[validate(length(min = 4, message = "satker di butuhkan"))]
    pub satker_id: String,
    #[validate(length(min = 4, message = "nrp di butuhkan"))]
    pub nrp: String,
    #[validate(length(min = 1, message = "full_name di butuhkan"))]
    pub full_name: String,
    #[validate(
        length(min = 4, message = "email di butuhkan"),
        email(message = "email invalid")
    )]
    pub email: String,
    pub phone: Option<String>,
    /// Optional: pangkat/golongan
    pub rank_id: Option<String>,
    pub role: Option<UserRole>,
    #[validate(length(
        min = 8,
        max = 64,
        message = "password harus di antara 8 sampai 64 karakter."
    ))]
    pub password: String,
    #[validate(
        length(
            min = 8,
            max = 64,
            message = "password harus di antara 8 sampai 64 karakter."
        ),
        must_match(other = "password", message = "password tidak sama")
    )]
    pub password_confirm: String,
}

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct UpdateUserReq {
    pub satker_id: Option<Uuid>,
    pub nrp: Option<String>,
    pub rank_id: Option<Uuid>,
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
}

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct UpdateMyProfileReq {
    #[validate(length(min = 1, message = "full_name di butuhkan"))]
    pub full_name: String,
    pub phone: Option<String>,
}

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct ChangeMyPasswordReq {
    #[validate(length(
        min = 8,
        max = 64,
        message = "password harus di antara 8 sampai 64 karakter."
    ))]
    pub old_password: String,
    #[validate(length(
        min = 8,
        max = 64,
        message = "password harus di antara 8 sampai 64 karakter."
    ))]
    pub password: String,
    #[validate(
        length(
            min = 8,
            max = 64,
            message = "password harus di antara 8 sampai 64 karakter."
        ),
        must_match(other = "password", message = "password tidak sama")
    )]
    pub password_confirm: String,
}

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct AdminSetPasswordReq {
    #[validate(length(
        min = 8,
        max = 64,
        message = "password harus di antara 8 sampai 64 karakter."
    ))]
    pub password: String,
    #[validate(
        length(
            min = 8,
            max = 64,
            message = "password harus di antara 8 sampai 64 karakter."
        ),
        must_match(other = "password", message = "password tidak sama")
    )]
    pub password_confirm: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct UserDto {
    pub id: Uuid,
    pub satker: SatkerDto,
    pub rank_id: Option<Uuid>,
    pub rank: Option<String>,
    pub nrp: String,
    pub full_name: String,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub profile_photo_key: Option<String>,
    pub role: UserRole,
    pub is_active: bool,
}

impl UserDto {
    pub fn to_row_with_satker(row: &User, satkers: &[Satker], ranks: &[Rank]) -> Self {
        let satker = SatkerDto::get_satker_dto(satkers, row.satker_id);

        let mut rank_name: Option<String> = None;

        if let Some(rank_id) = row.rank_id {
            let rank = RankDto::get_rank_dto(ranks, rank_id);
            rank_name = Some(rank.name);
        }

        UserDto {
            id: row.id,
            satker: satker.clone(),
            rank_id: row.rank_id,
            rank: rank_name,
            nrp: row.nrp.clone(),
            full_name: row.full_name.clone(),
            email: row.email.clone(),
            phone: row.phone.clone(),
            profile_photo_key: row.profile_photo_key.clone(),
            role: row.role,
            is_active: row.is_active,
        }
    }
    pub fn to_rows_with_satker(rows: &[User], satkers: &[Satker], ranks: &[Rank]) -> Vec<UserDto> {
        rows.iter()
            .map(|r| UserDto::to_row_with_satker(r, satkers, ranks))
            .collect()
    }

    pub fn to_row_dto(row: &User, satker: &Satker, ranks: &[Rank]) -> Self {
        let satker_dto = SatkerDto::to_row(satker);

        let mut rank_name: Option<String> = None;

        if let Some(rank_id) = row.rank_id {
            let rank = RankDto::get_rank_dto(ranks, rank_id);
            rank_name = Some(rank.name);
        }
        UserDto {
            id: row.id,
            satker: satker_dto.clone(),
            rank_id: row.rank_id,
            rank: rank_name,
            nrp: row.nrp.clone(),
            full_name: row.full_name.clone(),
            email: row.email.clone(),
            phone: row.phone.clone(),
            profile_photo_key: row.profile_photo_key.clone(),
            role: row.role,
            is_active: row.is_active,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct UserResp {
    pub status: &'static str,
    pub data: UserDto,
}

#[derive(Serialize, Debug, Clone)]
pub struct UsersResp {
    pub status: &'static str,
    pub data: Vec<UserDto>,
}
