use chrono::NaiveDate;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Deserialize, Debug, Clone)]
pub struct SetHeadReq {
    pub user_id: Uuid,
}

#[derive(Serialize, Debug, Clone, sqlx::FromRow)]
pub struct SarkerHeadDto {
    pub user_id: Uuid,
    pub full_name: String,
    pub nrp: String,
    pub phone: Option<String>,
    pub satker_id: Uuid,
    pub satker_name: String,
    pub satker_code: String,
    pub active_from: NaiveDate,
    pub active_to: Option<NaiveDate>,
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct SarkerHeadResp {
    pub status: &'static str,
    pub data: Vec<SarkerHeadDto>,
}
