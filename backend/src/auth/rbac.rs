use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "user_role", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum UserRole {
    Superadmin,
    SatkerAdmin,
    SatkerHead,
    Member,
}

impl UserRole {
    pub fn can_manage_satkers(&self) -> bool {
        matches!(self, UserRole::Superadmin)
    }
    pub fn can_manage_satker_users(&self) -> bool {
        matches!(self, UserRole::Superadmin | UserRole::SatkerAdmin)
    }
    pub fn can_approve_leave(&self) -> bool {
        matches!(self, UserRole::Superadmin | UserRole::SatkerHead)
    }

    pub fn can_view_leave(&self) -> bool {
        matches!(self, UserRole::Superadmin | UserRole::SatkerHead | UserRole::SatkerAdmin)
    }

    pub fn is_admin(&self) -> bool {
        matches!(self, UserRole::Superadmin | UserRole::SatkerAdmin)
    }


}