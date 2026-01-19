use crate::DBClient;
use crate::constants::ScheduleType;
use crate::dtos::duty_schedule::DutyScheduleDto;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait DutyScheduleRepo {
    async fn create_duty_schedule(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        schedule_type: ScheduleType,
        title: Option<String>,
        note: Option<String>,
        created_by: Uuid,
    ) -> Result<(), Error>;

    async fn update_duty_schedule(
        &self,
        id: Uuid,
        start_at: Option<DateTime<Utc>>,
        end_at: Option<DateTime<Utc>>,
        schedule_type: Option<ScheduleType>,
        title: Option<String>,
        note: Option<String>,
    ) -> Result<(), Error>;

    async fn soft_delete_duty_schedule(&self, id: Uuid) -> Result<(), Error>;

    async fn find_duty_schedule(&self, id: Uuid) -> Result<Option<DutyScheduleDto>, Error>;

    async fn list_duty_schedules(
        &self,
        satker_id: Option<Uuid>,
        user_id: Option<Uuid>,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<DutyScheduleDto>, Error>;

    async fn has_overlap(
        &self,
        user_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        exclude_id: Option<Uuid>,
    ) -> Result<bool, Error>;
}

#[async_trait]
impl DutyScheduleRepo for DBClient {
    async fn create_duty_schedule(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        schedule_type: ScheduleType,
        title: Option<String>,
        note: Option<String>,
        created_by: Uuid,
    ) -> Result<(), Error> {
        // Keep legacy columns (schedule_date/start_time/end_time) populated for compatibility.
        sqlx::query!(
            r#"
            INSERT INTO duty_schedules (
                satker_id, user_id,
                schedule_date, start_time, end_time,
                start_at, end_at,
                type, title, notes, created_by
            )
            VALUES (
                $1, $2,
                ($3 AT TIME ZONE 'UTC')::date,
                ($3 AT TIME ZONE 'UTC')::time,
                ($4 AT TIME ZONE 'UTC')::time,
                $3, $4,
                $5, $6, $7, $8
            )
            "#,
            satker_id,
            user_id,
            start_at,
            end_at,
            schedule_type as ScheduleType,
            title,
            note,
            created_by
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn update_duty_schedule(
        &self,
        id: Uuid,
        start_at: Option<DateTime<Utc>>,
        end_at: Option<DateTime<Utc>>,
        schedule_type: Option<ScheduleType>,
        title: Option<String>,
        note: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE duty_schedules
            SET
                start_at = COALESCE($2, start_at),
                end_at = COALESCE($3, end_at),
                schedule_date = COALESCE(( $2 AT TIME ZONE 'UTC')::date, schedule_date),
                start_time = COALESCE(( $2 AT TIME ZONE 'UTC')::time, start_time),
                end_time = COALESCE(( $3 AT TIME ZONE 'UTC')::time, end_time),
                type = COALESCE($4::schedule_type, type),
                title = COALESCE($5, title),
                notes = COALESCE($6, notes),
                updated_at = now()
            WHERE id = $1 AND deleted_at IS NULL
            "#,
            id,
            start_at,
            end_at,
            schedule_type as _,
            title,
            note
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn soft_delete_duty_schedule(&self, id: Uuid) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE duty_schedules
            SET deleted_at = now(), updated_at = now()
            WHERE id = $1 AND deleted_at IS NULL
            "#,
            id
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn find_duty_schedule(&self, id: Uuid) -> Result<Option<DutyScheduleDto>, Error> {
        let row = sqlx::query_as!(
            DutyScheduleDto,
            r#"
            SELECT ds.id,
                   ds.satker_id,
                   s.code AS satker_code,
                   s.name AS satker_name,
                   ds.user_id,
                   u.full_name AS user_full_name,
                   u.nrp AS user_nrp,
                   u.phone AS user_phone,
                   ds.start_at as "start_at!",
                   ds.end_at as "end_at!",
                   ds.type as "schedule_type: ScheduleType",
                   ds.title,
                   ds.notes as note,
                   ds.created_by,
                   ds.created_at,
                   ds.updated_at
            FROM duty_schedules ds
            JOIN satkers s ON s.id = ds.satker_id
            JOIN users u ON u.id = ds.user_id
            WHERE ds.id = $1 AND ds.deleted_at IS NULL
            "#,
            id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row)
    }

    async fn list_duty_schedules(
        &self,
        satker_id: Option<Uuid>,
        user_id: Option<Uuid>,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<DutyScheduleDto>, Error> {
        let rows = sqlx::query_as!(
            DutyScheduleDto,
            r#"
            SELECT ds.id,
                   ds.satker_id,
                   s.code AS satker_code,
                   s.name AS satker_name,
                   ds.user_id,
                   u.full_name AS user_full_name,
                   u.nrp AS user_nrp,
                   u.phone AS user_phone,
                   ds.start_at as "start_at!",
                   ds.end_at as "end_at!",
                   ds.type as "schedule_type: ScheduleType",
                   ds.title,
                   ds.notes as note,
                   ds.created_by,
                   ds.created_at,
                   ds.updated_at
            FROM duty_schedules ds
            JOIN satkers s ON s.id = ds.satker_id
            JOIN users u ON u.id = ds.user_id
            WHERE ds.deleted_at IS NULL
              AND ds.start_at >= $1
              AND ds.start_at < $2
              AND ($3::uuid IS NULL OR ds.satker_id = $3)
              AND ($4::uuid IS NULL OR ds.user_id = $4)
            ORDER BY ds.start_at ASC
            "#,
            from,
            to,
            satker_id,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    async fn has_overlap(
        &self,
        user_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        exclude_id: Option<Uuid>,
    ) -> Result<bool, Error> {
        // overlap condition: existing.start < new_end AND existing.end > new_start
        let row = sqlx::query!(
            r#"
            SELECT 1 as one
            FROM duty_schedules
            WHERE deleted_at IS NULL
              AND user_id = $1
              AND start_at < $3
              AND end_at > $2
              AND ($4::uuid IS NULL OR id <> $4)
            LIMIT 1
            "#,
            user_id,
            start_at,
            end_at,
            exclude_id
        )
        .fetch_optional(&self.pool)
        .await?;
        Ok(row.is_some())
    }
}
