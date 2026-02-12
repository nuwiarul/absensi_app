use crate::DBClient;
use crate::constants::ScheduleType;
use crate::dtos::schedule::ScheduleDto;
use async_trait::async_trait;
use chrono::{NaiveDate, NaiveTime};
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait ScheduleRepo {
    async fn create_schedule(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        schedule_date: NaiveDate,
        schedule_type: ScheduleType,
        start_time: Option<NaiveTime>,
        end_time: Option<NaiveTime>,
        notes: Option<String>,
        create_by: Uuid,
    ) -> Result<(), Error>;

    async fn list_satker_schedule(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<ScheduleDto>, Error>;

    async fn list_satker_schedule_user(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<ScheduleDto>, Error>;

    async fn list_my_schedule(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<ScheduleDto>, Error>;
}

#[async_trait]
impl ScheduleRepo for DBClient {
    async fn create_schedule(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        schedule_date: NaiveDate,
        schedule_type: ScheduleType,
        start_time: Option<NaiveTime>,
        end_time: Option<NaiveTime>,
        notes: Option<String>,
        create_by: Uuid,
    ) -> Result<(), Error> {
        sqlx::query!(
        r#"
        INSERT INTO duty_schedules (satker_id, user_id, schedule_date, type, start_time, end_time, notes, created_by)
        VALUES ($1, $2, $3, $4, $5::time, $6::time, $7, $8)
        "#,
        satker_id,
        user_id,
        schedule_date,
        schedule_type as ScheduleType,
        start_time,
        end_time,
        notes,
        create_by,
        ).execute(&self.pool).await?;

        Ok(())
    }

    async fn list_satker_schedule(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<ScheduleDto>, Error> {
        let rows = sqlx::query_as!(
            ScheduleDto,
            r#"
            SELECT ds.id,
                   ds.satker_id,
                   s.code AS satker_code,
                   s.name AS satker_name,
                   ds.user_id,
                   u.full_name AS user_full_name,
                   u.nrp AS user_nrp,
                   u.phone AS user_phone,
                   ds.schedule_date,
                   ds.type as "schedule_type: ScheduleType",
                   ds.start_time,
                   ds.end_time,
                   ds.notes,
                   ds.created_by,
                   ds.created_at
            FROM duty_schedules ds
            JOIN satkers s ON s.id = ds.satker_id
            JOIN users u ON u.id = ds.user_id
            WHERE
                ds.satker_id = $1 AND
                ds.schedule_date >= $2 AND
                ds.schedule_date <= $3
            "#,
            satker_id,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    async fn list_satker_schedule_user(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<ScheduleDto>, Error> {
        let rows = sqlx::query_as!(
            ScheduleDto,
            r#"
            SELECT ds.id,
                   ds.satker_id,
                   s.code AS satker_code,
                   s.name AS satker_name,
                   ds.user_id,
                   u.full_name AS user_full_name,
                   u.nrp AS user_nrp,
                   u.phone AS user_phone,
                   ds.schedule_date,
                   ds.type as "schedule_type: ScheduleType",
                   ds.start_time,
                   ds.end_time,
                   ds.notes,
                   ds.created_by,
                   ds.created_at
            FROM duty_schedules ds
            JOIN satkers s ON s.id = ds.satker_id
            JOIN users u ON u.id = ds.user_id
            WHERE
                ds.satker_id = $1 AND
                ds.user_id = $2 AND
                ds.schedule_date >= $3 AND
                ds.schedule_date <= $4
            "#,
            satker_id,
            user_id,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    async fn list_my_schedule(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<ScheduleDto>, Error> {
        let rows = sqlx::query_as!(
            ScheduleDto,
            r#"
            SELECT ds.id,
                   ds.satker_id,
                   s.code AS satker_code,
                   s.name AS satker_name,
                   ds.user_id,
                   u.full_name AS user_full_name,
                   u.nrp AS user_nrp,
                   u.phone AS user_phone,
                   ds.schedule_date,
                   ds.type as "schedule_type: ScheduleType",
                   ds.start_time,
                   ds.end_time,
                   ds.notes,
                   ds.created_by,
                   ds.created_at
            FROM duty_schedules ds
            JOIN satkers s ON s.id = ds.satker_id
            JOIN users u ON u.id = ds.user_id
            WHERE
                ds.user_id = $1 AND
                ds.schedule_date >= $2 AND
                ds.schedule_date <= $3
            "#,
            user_id,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }
}
