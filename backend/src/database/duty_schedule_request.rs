use crate::DBClient;
use crate::constants::ScheduleType;
use crate::dtos::duty_schedule_request::DutyScheduleRequestDto;
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait DutyScheduleRequestRepo {
    async fn create_duty_schedule_request(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        schedule_type: ScheduleType,
        title: Option<String>,
        note: Option<String>,
    ) -> Result<Uuid, Error>;

    async fn list_duty_schedule_requests(
        &self,
        satker_id: Option<Uuid>,
        user_id: Option<Uuid>,
        status: Option<&str>,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<DutyScheduleRequestDto>, Error>;

    async fn has_overlap_submitted(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        exclude_id: Option<Uuid>,
    ) -> Result<bool, Error>;
}

#[async_trait]
impl DutyScheduleRequestRepo for DBClient {
    async fn create_duty_schedule_request(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        schedule_type: ScheduleType,
        title: Option<String>,
        note: Option<String>,
    ) -> Result<Uuid, Error> {
        let row = sqlx::query!(
            r#"
            INSERT INTO duty_schedule_requests (
                satker_id, user_id, start_at, end_at,
                schedule_type, title, note, status
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'SUBMITTED')
            RETURNING id
            "#,
            satker_id,
            user_id,
            start_at,
            end_at,
            schedule_type as ScheduleType,
            title,
            note
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row.id)
    }

    async fn list_duty_schedule_requests(
        &self,
        satker_id: Option<Uuid>,
        user_id: Option<Uuid>,
        status: Option<&str>,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Vec<DutyScheduleRequestDto>, Error> {
        // NOTE: overlap range filter (start < to AND end > from)
        let rows = sqlx::query_as!(
            DutyScheduleRequestDto,
            r#"
            SELECT r.id,
                   r.satker_id,
                   s.code AS satker_code,
                   s.name AS satker_name,
                   r.user_id,
                   u.full_name AS user_full_name,
                   u.nrp AS user_nrp,
                   u.phone AS user_phone,
                   r.start_at as "start_at!",
                   r.end_at as "end_at!",
                   r.schedule_type as "schedule_type: ScheduleType",
                   r.title,
                   r.note,
                   r.status,
                   r.reject_reason,
                   r.decided_by,
                   r.decided_at,
                   r.created_at as "created_at!",
                   r.updated_at as "updated_at!"
            FROM duty_schedule_requests r
            JOIN satkers s ON s.id = r.satker_id
            JOIN users u ON u.id = r.user_id
            WHERE ($1::uuid IS NULL OR r.satker_id = $1)
              AND ($2::uuid IS NULL OR r.user_id = $2)
              AND ($3::text IS NULL OR r.status = $3)
              AND r.start_at < $5
              AND r.end_at > $4
            ORDER BY r.start_at ASC
            "#,
            satker_id,
            user_id,
            status,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn has_overlap_submitted(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        start_at: DateTime<Utc>,
        end_at: DateTime<Utc>,
        exclude_id: Option<Uuid>,
    ) -> Result<bool, Error> {
        let row = sqlx::query!(
            r#"
            SELECT 1 as one
            FROM duty_schedule_requests
            WHERE satker_id = $1
              AND user_id = $2
              AND status = 'SUBMITTED'
              AND start_at < $4
              AND end_at > $3
              AND ($5::uuid IS NULL OR id <> $5)
            LIMIT 1
            "#,
            satker_id,
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
