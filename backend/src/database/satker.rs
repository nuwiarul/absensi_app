use crate::db::DBClient;
use crate::models::Satker;
use async_trait::async_trait;
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait SatkerRepo {
    async fn find_satker_by_id(&self, id: Uuid) -> Result<Option<Satker>, Error>;
    async fn get_satker_all(&self) -> Result<Vec<Satker>, Error>;
    async fn create_satker(&self, code: String, name: String) -> Result<(), Error>;

    async fn update_satker(
        &self,
        id: Uuid,
        code: Option<String>,
        name: Option<String>,
    ) -> Result<(), Error>;

    async fn delete_satker(&self, id: Uuid) -> Result<(), Error>;
}

#[async_trait]
impl SatkerRepo for DBClient {
    async fn find_satker_by_id(&self, id: Uuid) -> Result<Option<Satker>, Error> {
        let row = sqlx::query_as!(
            Satker,
            r#"
            SELECT id, code, name, is_active, created_at, updated_at
            FROM satkers
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    async fn get_satker_all(&self) -> Result<Vec<Satker>, Error> {
        let rows = sqlx::query_as!(
            Satker,
            r#"
            SELECT id, code, name, is_active, created_at, updated_at
            FROM satkers
            "#
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    async fn create_satker(&self, code: String, name: String) -> Result<(), Error> {
        sqlx::query!(
            r#"
            INSERT INTO satkers (code, name) VALUES ($1, $2)
            "#,
            code,
            name
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn update_satker(
        &self,
        id: Uuid,
        code: Option<String>,
        name: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE satkers
            SET code = COALESCE($2, code),
                name = COALESCE($3, name),
                updated_at = NOW()
            WHERE id = $1
            "#,
            id,
            code,
            name
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn delete_satker(&self, id: Uuid) -> Result<(), Error> {
        sqlx::query!(
            r#"
            DELETE FROM satkers WHERE id = $1
            "#,
            id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
