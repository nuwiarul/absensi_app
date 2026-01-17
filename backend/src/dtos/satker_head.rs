use serde::Deserialize;
use uuid::Uuid;

#[derive(Deserialize, Debug, Clone)]
pub struct SetHeadReq {
    pub user_id: Uuid,
}

