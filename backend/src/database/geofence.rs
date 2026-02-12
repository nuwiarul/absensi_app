use crate::db::DBClient;
use crate::models::Geofence;
use async_trait::async_trait;
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait GeofenceRepo {
    async fn create_geofence(
        &self,
        satker_id: Uuid,
        name: String,
        latitude: f64,
        longitude: f64,
        radius: i32,
        is_active: Option<bool>,
    ) -> Result<(), Error>;

    async fn update_geofence(
        &self,
        id: Uuid,
        name: Option<String>,
        latitude: Option<f64>,
        longitude: Option<f64>,
        radius: Option<i32>,
    ) -> Result<(), Error>;

    async fn delete_geofence(&self, id: Uuid) -> Result<(), Error>;

    async fn list_geofences(&self) -> Result<Vec<Geofence>, Error>;

    async fn list_geofences_by_satker(&self, satker_id: Uuid) -> Result<Vec<Geofence>, Error>;

    async fn find_geofence(&self, id: Uuid) -> Result<Option<Geofence>, Error>;

    async fn list_active_geofences_by_satker(
        &self,
        satker_id: Uuid,
    ) -> Result<Vec<Geofence>, Error>;
}

#[async_trait]
impl GeofenceRepo for DBClient {
    async fn create_geofence(
        &self,
        satker_id: Uuid,
        name: String,
        latitude: f64,
        longitude: f64,
        radius: i32,
        is_active: Option<bool>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            INSERT INTO geofences (satker_id, name, latitude, longitude, radius_meters, is_active)
            VALUES ($1, $2, $3, $4, $5, COALESCE($6, true))
            "#,
            satker_id,
            name,
            latitude,
            longitude,
            radius,
            is_active
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn update_geofence(
        &self,
        id: Uuid,
        name: Option<String>,
        latitude: Option<f64>,
        longitude: Option<f64>,
        radius: Option<i32>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE geofences SET
                name = COALESCE($2, name),
                latitude = COALESCE($3, latitude),
                longitude = COALESCE($4, longitude),
                radius_meters = COALESCE($5, radius_meters)
            WHERE id = $1
            "#,
            id,
            name,
            latitude,
            longitude,
            radius
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn delete_geofence(&self, id: Uuid) -> Result<(), Error> {
        sqlx::query!(
            r#"
           DELETE FROM geofences
            WHERE id = $1
            "#,
            id,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn list_geofences(&self) -> Result<Vec<Geofence>, Error> {
        let rows = sqlx::query_as!(
            Geofence,
            r#"
            SELECT id, satker_id, name, latitude, longitude, radius_meters, is_active, created_at
            FROM geofences
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn list_geofences_by_satker(&self, satker_id: Uuid) -> Result<Vec<Geofence>, Error> {
        let rows = sqlx::query_as!(
            Geofence,
            r#"
            SELECT id, satker_id, name, latitude, longitude, radius_meters, is_active, created_at
            FROM geofences
            WHERE satker_id = $1
            "#,
            satker_id,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn find_geofence(&self, id: Uuid) -> Result<Option<Geofence>, Error> {
        let row = sqlx::query_as!(
            Geofence,
            r#"
            SELECT id, satker_id, name, latitude, longitude, radius_meters, is_active, created_at
            FROM geofences
            WHERE id = $1 AND is_active = TRUE
            "#,
            id,
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    async fn list_active_geofences_by_satker(
        &self,
        satker_id: Uuid,
    ) -> Result<Vec<Geofence>, Error> {
        let rows = sqlx::query_as!(
            Geofence,
            r#"
            SELECT id, satker_id, name, latitude, longitude, radius_meters, is_active, created_at
            FROM geofences
            WHERE satker_id = $1 AND is_active = TRUE
            "#,
            satker_id,
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }
}
