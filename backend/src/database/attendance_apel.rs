use crate::db::DBClient;
use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::Error;
use uuid::Uuid;
use crate::dtos::attendance_apel::AttendanceApelDto;

#[async_trait]
pub trait AttendanceApelRepo {
    /// Upsert apel per (user_id, work_date, kind).
    ///
    /// - `kind`: contoh "PAGI" / "SORE" (saat ini pakai "PAGI")
    /// - `source_event`: "CHECKIN" / "CHECKOUT"
    async fn upsert_attendance_apel(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        work_date: NaiveDate,
        occurred_at: DateTime<Utc>,
        kind: &str,
        source_event: &str,
    ) -> Result<(), Error>;

    async fn list_attendance_apel_by_user_from_to(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<AttendanceApelDto>, Error>;

}

#[async_trait]
impl AttendanceApelRepo for DBClient {
    async fn upsert_attendance_apel(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        work_date: NaiveDate,
        occurred_at: DateTime<Utc>,
        kind: &str,
        source_event: &str,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            INSERT INTO attendance_apel (satker_id, user_id, work_date, occurred_at, kind, source_event)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (user_id, work_date, kind)
            DO UPDATE SET
              occurred_at = EXCLUDED.occurred_at,
              source_event = EXCLUDED.source_event,
              satker_id = EXCLUDED.satker_id,
              updated_at = NOW()
            "#,
            satker_id,
            user_id,
            work_date,
            occurred_at,
            kind,
            source_event,
        )
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn list_attendance_apel_by_user_from_to(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<AttendanceApelDto>, Error> {
        let rows = sqlx::query_as!(
        AttendanceApelDto,
        r#"
        SELECT
          work_date,
          occurred_at,
          kind,
          source_event
        FROM attendance_apel
        WHERE user_id = $1
          AND work_date >= $2
          AND work_date <= $3
        ORDER BY work_date DESC, occurred_at DESC
        "#,
        user_id,
        from,
        to,
    )
            .fetch_all(&self.pool)
            .await?;

        Ok(rows)
    }
}
