use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct ChallengePayload {
    pub user_id: Uuid,
    pub satker_id: Uuid,
    pub device_id: String,
    pub nonce: String,
    pub exp_unix: i64,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct LastLoc {
    pub lat: f64,
    pub lon: f64,
    pub ts_unix: i64,
}

#[derive(Debug, Serialize)]
pub struct ChallengeDto {
    pub challenge_id: Uuid,
    pub nonce: String,
    pub expires_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct ChallengeResp {
    pub status: &'static str,
    pub data: ChallengeDto,
}
