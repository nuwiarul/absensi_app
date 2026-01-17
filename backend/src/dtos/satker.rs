use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;
use crate::models::{Satker, User};

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct CreateSatkerReq {
    #[validate(length(min = 1, message = "code di butuhkan"))]
    pub code: String,
    #[validate(length(min = 1, message = "nama di butuhkan"))]
    pub name: String,
}

#[derive(Deserialize, Debug, Clone)]
pub struct UpdateSatkerReq {
    pub code: Option<String>,
    pub name: Option<String>,
}

#[derive(Serialize,Debug, Clone)]
pub struct SatkerDto {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub is_active: bool,
}

impl SatkerDto {
    pub fn to_row(row: &Satker) -> Self {
        SatkerDto {
            id: row.id,
            code: row.code.clone(),
            name: row.name.clone(),
            is_active: row.is_active,
        }
    }

    pub fn to_rows(rows: &[Satker]) -> Vec<SatkerDto> {
        rows.iter().map(SatkerDto::to_row).collect()
    }

    pub fn get_satker_dto(rows: &[Satker], id: Uuid) -> Self {
        rows.iter()
            .find(|r| r.id == id)
            .map(SatkerDto::to_row)
            .unwrap_or_else(|| {
                SatkerDto {
                    id: Uuid::nil(),
                    code: "".to_string(),
                    name: "Not Found".to_string(),
                    is_active: false,
                }
            })
    }
}

#[derive(Serialize, Debug, Clone, )]
pub struct SatkerResp {
    pub status: &'static str,
    pub data: SatkerDto,
}

#[derive(Serialize, Debug, Clone, )]
pub struct SatkersResp {
    pub status: &'static str,
    pub data: Vec<SatkerDto>,
}