use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AnnouncementScope {
    Global,
    Satker,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnouncementDto {
    pub id: Uuid,
    pub scope: String,
    pub satker_id: Option<Uuid>,
    pub satker_name: Option<String>,
    pub satker_code: Option<String>,
    pub title: String,
    pub body: String,
    pub is_active: bool,
    pub created_by: Uuid,
    pub created_by_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateAnnouncementReq {
    pub scope: String, // "GLOBAL" | "SATKER"
    pub satker_id: Option<Uuid>,
    pub title: String,
    pub body: String,
    pub is_active: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateAnnouncementReq {
    pub scope: Option<String>,
    pub satker_id: Option<Uuid>,
    pub title: Option<String>,
    pub body: Option<String>,
    pub is_active: Option<bool>,
}
