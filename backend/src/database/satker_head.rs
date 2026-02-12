use crate::db::DBClient;
use crate::dtos::satker_head::SarkerHeadDto;
use async_trait::async_trait;
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait SatkerHeadRepo {
    async fn add_satker_head(&self, satker_id: Uuid, new_head: Uuid) -> Result<(), Error>;

    async fn retire_satker_head(&self, satker_id: Uuid) -> Result<(), Error>;

    async fn is_current_head_satker(&self, satker_id: Uuid, user_id: Uuid) -> Result<bool, Error>;

    async fn list_all_head_satker(&self) -> Result<Vec<SarkerHeadDto>, Error>;
    async fn list_head_satker_by_satker_id(
        &self,
        satker_id: Uuid,
    ) -> Result<Vec<SarkerHeadDto>, Error>;
}

#[async_trait]
impl SatkerHeadRepo for DBClient {
    async fn add_satker_head(&self, satker_id: Uuid, new_head: Uuid) -> Result<(), Error> {
        sqlx::query!(
            r#"
        INSERT INTO satker_heads (satker_id, user_id, active_from, active_to)
        VALUES ($1, $2, CURRENT_DATE, NULL)
        "#,
            satker_id,
            new_head
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn retire_satker_head(&self, satker_id: Uuid) -> Result<(), Error> {
        sqlx::query!(
            r#"
        UPDATE satker_heads
        SET active_to = CURRENT_DATE
        WHERE satker_id = $1 AND active_to IS NULL
        "#,
            satker_id
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn is_current_head_satker(&self, satker_id: Uuid, user_id: Uuid) -> Result<bool, Error> {
        let row = sqlx::query!(
            r#"
            SELECT id
            FROM satker_heads
            WHERE
                satker_id = $1 AND
                user_id = $2 AND
                active_to IS NULL
        "#,
            satker_id,
            user_id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.is_some())
    }

    async fn list_all_head_satker(&self) -> Result<Vec<SarkerHeadDto>, Error> {
        let rows = sqlx::query_as!(
            SarkerHeadDto,
            r#"
            SELECT
                sh.user_id,
                u.full_name,
                u.nrp,
                u.phone,
                sh.satker_id,
                s.name AS satker_name,
                s.code AS satker_code,
                sh.active_from,
                sh.active_to,
                CASE
                    WHEN active_to IS NULL THEN 'AKTIF'
                    ELSE 'RETIRE'
                END AS status
            FROM satker_heads sh
            JOIN users u ON u.id = sh.user_id
            JOIN satkers s On s.id = sh.satker_id
            ORDER BY active_from DESC
            "#
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }
    async fn list_head_satker_by_satker_id(
        &self,
        satker_id: Uuid,
    ) -> Result<Vec<SarkerHeadDto>, Error> {
        let rows = sqlx::query_as!(
            SarkerHeadDto,
            r#"
            SELECT
                sh.user_id,
                u.full_name,
                u.nrp,
                u.phone,
                sh.satker_id,
                s.name AS satker_name,
                s.code AS satker_code,
                sh.active_from,
                sh.active_to,
                CASE
                    WHEN active_to IS NULL THEN 'AKTIF'
                    ELSE 'RETIRE'
                END AS status
            FROM satker_heads sh
            JOIN users u ON u.id = sh.user_id
            JOIN satkers s On s.id = sh.satker_id
            WHERE sh.satker_id = $1
            ORDER BY active_from DESC
            "#,
            satker_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }
}
