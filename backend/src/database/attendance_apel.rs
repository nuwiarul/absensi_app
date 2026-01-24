use crate::db::DBClient;
use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::Error;
use uuid::Uuid;

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
}
