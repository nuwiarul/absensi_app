use crate::constants::CalendarDayType;
use crate::db::DBClient;
use crate::models::SatkerCalendarDay;
use async_trait::async_trait;
use chrono::{NaiveDate, NaiveTime};
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait WorkCalendarRepo {
    async fn upsert_calendar_day(
        &self,
        satker_id: Uuid,
        work_date: NaiveDate,
        day_type: CalendarDayType,
        expected_start: Option<NaiveTime>,
        expected_end: Option<NaiveTime>,
        note: Option<String>,
    ) -> Result<(), Error>;

    async fn list_calendar_days(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<SatkerCalendarDay>, Error>;

    async fn delete_calendar_day(&self, satker_id: Uuid, work_date: NaiveDate)
    -> Result<(), Error>;
}

#[async_trait]
impl WorkCalendarRepo for DBClient {
    async fn upsert_calendar_day(
        &self,
        satker_id: Uuid,
        work_date: NaiveDate,
        day_type: CalendarDayType,
        expected_start: Option<NaiveTime>,
        expected_end: Option<NaiveTime>,
        note: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            INSERT INTO satker_calendar_days (satker_id, work_date, day_type, expected_start, expected_end, note)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (satker_id, work_date) DO UPDATE SET
              day_type = EXCLUDED.day_type,
              expected_start = EXCLUDED.expected_start,
              expected_end = EXCLUDED.expected_end,
              note = EXCLUDED.note,
              updated_at = now()
            "#,
            satker_id,
            work_date,
            day_type as CalendarDayType,
            expected_start,
            expected_end,
            note
        )
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn list_calendar_days(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<SatkerCalendarDay>, Error> {
        let rows = sqlx::query_as!(
            SatkerCalendarDay,
            r#"
            SELECT
              satker_id,
              work_date,
              day_type as "day_type: CalendarDayType",
              expected_start,
              expected_end,
              note
            FROM satker_calendar_days
            WHERE satker_id = $1
              AND work_date BETWEEN $2 AND $3
            ORDER BY work_date ASC
            "#,
            satker_id,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn delete_calendar_day(
        &self,
        satker_id: Uuid,
        work_date: NaiveDate,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"DELETE FROM satker_calendar_days WHERE satker_id = $1 AND work_date = $2"#,
            satker_id,
            work_date
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}
