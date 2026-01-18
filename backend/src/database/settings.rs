use crate::db::DBClient;
use sqlx::Row;
use uuid::Uuid;

pub const SETTING_DEFAULT_TIMEZONE: &str = "default_timezone";
pub const DEFAULT_TIMEZONE_VALUE: &str = "Asia/Jakarta";

pub trait SettingsRepo {
    async fn get_setting(&self, key: &str) -> Result<Option<String>, sqlx::Error>;
    async fn upsert_setting(&self, key: &str, value: &str, updated_by: Uuid) -> Result<(), sqlx::Error>;

    /// Returns the configured operational timezone, or a safe default.
    async fn get_timezone_value(&self) -> Result<String, sqlx::Error>;
}

impl SettingsRepo for DBClient {
    async fn get_setting(&self, key: &str) -> Result<Option<String>, sqlx::Error> {
        let row = sqlx::query("SELECT value FROM app_settings WHERE key = $1")
            .bind(key)
            .fetch_optional(&self.pool)
            .await?;
        Ok(row.map(|r| r.get::<String, _>("value")))
    }

    async fn upsert_setting(&self, key: &str, value: &str, updated_by: Uuid) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO app_settings(key, value, updated_at, updated_by)\n             VALUES ($1, $2, NOW(), $3)\n             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by",
        )
        .bind(key)
        .bind(value)
        .bind(updated_by)
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn get_timezone_value(&self) -> Result<String, sqlx::Error> {
        Ok(self
            .get_setting(SETTING_DEFAULT_TIMEZONE)
            .await?
            .unwrap_or_else(|| DEFAULT_TIMEZONE_VALUE.to_string()))
    }
}
