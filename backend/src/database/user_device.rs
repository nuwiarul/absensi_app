use crate::DBClient;
use async_trait::async_trait;
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait UserDeviceRepo {
    async fn ensure_device_bound_first_user(
        &self,
        user_id: Uuid,
        device_id: &str,
        device_model: Option<String>,
        android_version: Option<String>,
        app_build: Option<String>,
        client_version: Option<String>,
    ) -> Result<(), Error>;
}

#[async_trait]
impl UserDeviceRepo for DBClient {
    async fn ensure_device_bound_first_user(
        &self,
        user_id: Uuid,
        device_id: &str,
        device_model: Option<String>,
        android_version: Option<String>,
        app_build: Option<String>,
        client_version: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            INSERT INTO user_devices (user_id, device_id, device_model, android_version, app_build, client_version)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (device_id) DO NOTHING
            "#,
            user_id,
            device_id,
            device_model,
            android_version,
            app_build,
            client_version
        ).execute(&self.pool).await?;

        Ok(())
    }
}
