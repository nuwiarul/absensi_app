use async_trait::async_trait;
use sqlx::Error;
use uuid::Uuid;

use crate::db::DBClient;
use crate::dtos::announcement::{AnnouncementDto, CreateAnnouncementReq, UpdateAnnouncementReq};

#[async_trait]
pub trait AnnouncementRepo {
    async fn list_visible_announcements(
        &self,
        satker_id: Uuid,
    ) -> Result<Vec<AnnouncementDto>, Error>;
    async fn list_manageable_announcements(
        &self,
        role_is_superadmin: bool,
        satker_id: Uuid,
    ) -> Result<Vec<AnnouncementDto>, Error>;
    async fn find_announcement_by_id(&self, id: Uuid) -> Result<Option<AnnouncementDto>, Error>;
    async fn create_announcement(
        &self,
        created_by: Uuid,
        req: CreateAnnouncementReq,
    ) -> Result<Uuid, Error>;
    async fn update_announcement(&self, id: Uuid, req: UpdateAnnouncementReq) -> Result<(), Error>;
    async fn deactivate_announcement(&self, id: Uuid) -> Result<(), Error>;
}

#[async_trait]
impl AnnouncementRepo for DBClient {
    async fn list_visible_announcements(
        &self,
        satker_id: Uuid,
    ) -> Result<Vec<AnnouncementDto>, Error> {
        let rows = sqlx::query_as!(
            AnnouncementDto,
            r#"
            SELECT
                a.id,
                a.scope,
                a.satker_id,
                s.name as "satker_name?",
                s.code as "satker_code?",
                a.title,
                a.body,
                a.is_active,
                a.created_by,
                u.full_name as created_by_name,
                a.created_at,
                a.updated_at
            FROM announcements a
            LEFT JOIN satkers s ON a.satker_id = s.id
            JOIN users u ON a.created_by = u.id
            WHERE
                a.is_active = true AND
                (
                    a.scope = 'GLOBAL' OR
                    (a.scope = 'SATKER' AND a.satker_id = $1)
                )
            ORDER BY a.created_at DESC
            "#,
            satker_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn list_manageable_announcements(
        &self,
        role_is_superadmin: bool,
        satker_id: Uuid,
    ) -> Result<Vec<AnnouncementDto>, Error> {
        if role_is_superadmin {
            let rows = sqlx::query_as!(
                AnnouncementDto,
                r#"
                SELECT
                    a.id,
                    a.scope,
                    a.satker_id,
                    s.name as "satker_name?",
                    s.code as "satker_code?",
                    a.title,
                    a.body,
                    a.is_active,
                    a.created_by,
                    u.full_name as created_by_name,
                    a.created_at,
                    a.updated_at
                FROM announcements a
                LEFT JOIN satkers s ON a.satker_id = s.id
                JOIN users u ON a.created_by = u.id
                ORDER BY a.created_at DESC
                "#
            )
            .fetch_all(&self.pool)
            .await?;
            return Ok(rows);
        }

        let rows = sqlx::query_as!(
            AnnouncementDto,
            r#"
            SELECT
                a.id,
                a.scope,
                a.satker_id,
                s.name as "satker_name?",
                s.code as "satker_code?",
                a.title,
                a.body,
                a.is_active,
                a.created_by,
                u.full_name as created_by_name,
                a.created_at,
                a.updated_at
            FROM announcements a
            LEFT JOIN satkers s ON a.satker_id = s.id
            JOIN users u ON a.created_by = u.id
            WHERE
                a.scope = 'GLOBAL' OR (a.scope = 'SATKER' AND a.satker_id = $1)
            ORDER BY a.created_at DESC
            "#,
            satker_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn find_announcement_by_id(&self, id: Uuid) -> Result<Option<AnnouncementDto>, Error> {
        let row = sqlx::query_as!(
            AnnouncementDto,
            r#"
            SELECT
                a.id,
                a.scope,
                a.satker_id,
                s.name as "satker_name?",
                s.code as "satker_code?",
                a.title,
                a.body,
                a.is_active,
                a.created_by,
                u.full_name as created_by_name,
                a.created_at,
                a.updated_at
            FROM announcements a
            LEFT JOIN satkers s ON a.satker_id = s.id
            JOIN users u ON a.created_by = u.id
            WHERE a.id = $1
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    async fn create_announcement(
        &self,
        created_by: Uuid,
        req: CreateAnnouncementReq,
    ) -> Result<Uuid, Error> {
        let is_active = req.is_active.unwrap_or(true);
        let row = sqlx::query!(
            r#"
            INSERT INTO announcements (scope, satker_id, title, body, is_active, created_by)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING id
            "#,
            req.scope,
            req.satker_id,
            req.title,
            req.body,
            is_active,
            created_by
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row.id)
    }

    async fn update_announcement(&self, id: Uuid, req: UpdateAnnouncementReq) -> Result<(), Error> {
        // Keep existing fields when None.
        sqlx::query!(
            r#"
            UPDATE announcements
            SET
                scope = COALESCE($2, scope),
                satker_id = COALESCE($3, satker_id),
                title = COALESCE($4, title),
                body = COALESCE($5, body),
                is_active = COALESCE($6, is_active)
            WHERE id = $1
            "#,
            id,
            req.scope,
            req.satker_id,
            req.title,
            req.body,
            req.is_active
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn deactivate_announcement(&self, id: Uuid) -> Result<(), Error> {
        sqlx::query!(
            r#"UPDATE announcements SET is_active=false WHERE id=$1"#,
            id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }
}
