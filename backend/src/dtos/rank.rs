use crate::models::Rank;
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct CreateRankReq {
    #[validate(length(min = 1, message = "code di butuhkan"))]
    pub code: String,
    #[validate(length(min = 1, message = "name di butuhkan"))]
    pub name: String,
    pub description: Option<String>,
    pub tukin_base: Option<i64>,
}

#[derive(Deserialize, Debug, Clone, Validate)]
pub struct UpdateRankReq {
    pub code: Option<String>,
    pub name: Option<String>,
    pub description: Option<String>,
    pub tukin_base: Option<i64>,
}

#[derive(Serialize, Debug, Clone)]
pub struct RankDto {
    pub id: Uuid,
    pub code: String,
    pub name: String,
    pub description: Option<String>,
    pub tukin_base: i64,
}

impl RankDto {
    pub fn to_row(row: &Rank) -> Self {
        RankDto {
            id: row.id,
            code: row.code.clone(),
            name: row.name.clone(),
            description: row.description.clone(),
            tukin_base: row.tukin_base,
        }
    }

    pub fn to_rows(rows: &[Rank]) -> Vec<RankDto> {
        rows.iter().map(RankDto::to_row).collect()
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct RankResp {
    pub status: &'static str,
    pub data: RankDto,
}

#[derive(Serialize, Debug, Clone)]
pub struct RanksResp {
    pub status: &'static str,
    pub data: Vec<RankDto>,
}
