use crate::db::DBClient;
use crate::models::Rank;
use async_trait::async_trait;
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait RankRepo {
    async fn list_ranks(&self) -> Result<Vec<Rank>, Error>;
    async fn find_rank_by_id(&self, id: Uuid) -> Result<Option<Rank>, Error>;
    async fn create_rank(
        &self,
        code: String,
        name: String,
        description: Option<String>,
        tukin_base: i64,
    ) -> Result<Rank, Error>;
    async fn update_rank(
        &self,
        id: Uuid,
        code: Option<String>,
        name: Option<String>,
        description: Option<String>,
        tukin_base: Option<i64>,
    ) -> Result<(), Error>;
    async fn delete_rank(&self, id: Uuid) -> Result<(), Error>;
}

#[async_trait]
impl RankRepo for DBClient {
    async fn list_ranks(&self) -> Result<Vec<Rank>, Error> {
        let rows = sqlx::query_as!(
            Rank,
            r#"
            SELECT id, code, name, description, tukin_base, created_at, updated_at
            FROM ranks
            ORDER BY code ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    async fn find_rank_by_id(&self, id: Uuid) -> Result<Option<Rank>, Error> {
        let row = sqlx::query_as!(
            Rank,
            r#"
            SELECT id, code, name, description, tukin_base, created_at, updated_at
            FROM ranks
            WHERE id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    async fn create_rank(
        &self,
        code: String,
        name: String,
        description: Option<String>,
        tukin_base: i64,
    ) -> Result<Rank, Error> {
        let row = sqlx::query_as!(
            Rank,
            r#"
            INSERT INTO ranks (code, name, description, tukin_base)
            VALUES ($1, $2, $3, $4)
            RETURNING id, code, name, description, tukin_base, created_at, updated_at
            "#,
            code,
            name,
            description,
            tukin_base
        )
        .fetch_one(&self.pool)
        .await?;
        Ok(row)
    }

    async fn update_rank(
        &self,
        id: Uuid,
        code: Option<String>,
        name: Option<String>,
        description: Option<String>,
        tukin_base: Option<i64>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE ranks
            SET code = COALESCE($2, code),
                name = COALESCE($3, name),
                description = COALESCE($4, description),
                tukin_base = COALESCE($5, tukin_base),
                updated_at = NOW()
            WHERE id = $1
            "#,
            id,
            code,
            name,
            description,
            tukin_base
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn delete_rank(&self, id: Uuid) -> Result<(), Error> {
        sqlx::query!(r#"DELETE FROM ranks WHERE id = $1"#, id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
