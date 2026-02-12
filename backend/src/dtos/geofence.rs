use crate::auth::rbac::UserRole;
use crate::dtos::satker::SatkerDto;
use crate::middleware::auth_middleware::UserClaims;
use crate::models::{Geofence, Satker};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use validator::Validate;

pub fn can_manage_geofence(user_claims: &UserClaims, satker_id: Uuid) -> bool {
    if user_claims.role == UserRole::Superadmin {
        return true;
    }

    user_claims.role == UserRole::SatkerAdmin && user_claims.satker_id == satker_id
}

pub fn can_view_geofence(user_claims: &UserClaims, satker_id: Uuid) -> bool {
    // semua role boleh lihat geofence satker sendiri (member butuh untuk absensi)
    user_claims.satker_id == satker_id || user_claims.role == UserRole::Superadmin
}

#[derive(Debug, Deserialize, Validate)]
pub struct CreateGeofenceReq {
    #[validate(length(min = 3, message = "Nama geofence minimal 3 karakter"))]
    pub name: String,

    #[validate(range(min = -90.0, max = 90.0, message = "Latitude harus antara -90 dan 90"))]
    pub latitude: f64,

    #[validate(range(min = -180.0, max = 180.0, message = "Longitude harus antara -180 dan 180"))]
    pub longitude: f64,

    #[validate(range(
        min = 10,
        max = 10000,
        message = "Radius minimal 10m dan maksimal 10km"
    ))]
    pub radius_meters: i32,
}

#[derive(Debug, Deserialize, Validate)]
pub struct UpdateGeofenceReq {
    pub name: Option<String>,
    #[validate(range(min = -90.0, max = 90.0, message = "Latitude harus antara -90 dan 90"))]
    pub latitude: Option<f64>,
    #[validate(range(min = -180.0, max = 180.0, message = "Longitude harus antara -180 dan 180"))]
    pub longitude: Option<f64>,
    #[validate(range(
        min = 10,
        max = 10000,
        message = "Radius minimal 10m dan maksimal 10km"
    ))]
    pub radius_meters: Option<i32>,
}

#[derive(Debug, Serialize, Clone)]
pub struct GeofenceDto {
    pub id: Uuid,
    pub satker: SatkerDto,
    pub name: String,
    pub latitude: f64,
    pub longitude: f64,
    pub radius_meters: i32,
    pub is_active: bool,
}

impl GeofenceDto {
    pub fn to_row_with_satker(row: &Geofence, satkers: &[Satker]) -> Self {
        let satker = SatkerDto::get_satker_dto(satkers, row.satker_id);
        GeofenceDto {
            id: row.id,
            satker: satker.clone(),
            name: row.name.clone(),
            latitude: row.latitude,
            longitude: row.longitude,
            radius_meters: row.radius_meters,
            is_active: row.is_active,
        }
    }
    pub fn to_rows_with_satker(rows: &[Geofence], satkers: &[Satker]) -> Vec<GeofenceDto> {
        rows.iter()
            .map(|r| GeofenceDto::to_row_with_satker(r, satkers))
            .collect()
    }

    pub fn to_row_dto(row: &Geofence, satker: &Satker) -> Self {
        let satker_dto = SatkerDto::to_row(satker);
        GeofenceDto {
            id: row.id,
            satker: satker_dto.clone(),
            name: row.name.clone(),
            latitude: row.latitude,
            longitude: row.longitude,
            radius_meters: row.radius_meters,
            is_active: row.is_active,
        }
    }
}

#[derive(Debug, Serialize, Clone)]
pub struct GeofenceResp {
    pub status: &'static str,
    pub data: GeofenceDto,
}

#[derive(Debug, Serialize, Clone)]
pub struct GeofencesResp {
    pub status: &'static str,
    pub data: Vec<GeofenceDto>,
}
