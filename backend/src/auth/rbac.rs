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

    /// Authorization for creating a user with a target role.
    /// - SUPERADMIN: can create SATKER_ADMIN/SATKER_HEAD/MEMBER
    /// - SATKER_ADMIN: can create SATKER_HEAD/MEMBER (cannot create SATKER_ADMIN)
    pub fn can_create_user_role(&self, target: UserRole) -> bool {
        match self {
            UserRole::Superadmin => matches!(target, UserRole::SatkerAdmin | UserRole::SatkerHead | UserRole::Member),
            UserRole::SatkerAdmin => matches!(target, UserRole::SatkerHead | UserRole::Member),
            _ => false,
        }
    }

    /// Authorization for listing satkers.
    pub fn can_list_satkers(&self) -> bool {
        matches!(self, UserRole::Superadmin | UserRole::SatkerAdmin)
    }

    /// Authorization for setting satker head.
    pub fn can_set_satker_head(&self) -> bool {
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