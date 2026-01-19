use crate::db::DBClient;
use crate::dtos::attendance_session::{RowAttendanceSession, UpdateAttendanceSession};
use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait AttendanceSessionRepo {
    async fn upsert_attendance_session(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        work_date: NaiveDate,
    ) -> Result<Uuid, Error>;

    async fn update_check_in_attendance_session(
        &self,
        session_id: Uuid,
        now: Option<DateTime<Utc>>,
    ) -> Result<UpdateAttendanceSession, Error>;

    async fn update_check_out_attendance_session(
        &self,
        session_id: Uuid,
        now: Option<DateTime<Utc>>,
    ) -> Result<UpdateAttendanceSession, Error>;

    async fn find_attendance_session(
        &self,
        session_id: Uuid,
    ) -> Result<RowAttendanceSession, Error>;

    /// SUPERADMIN only: overwrite check-in/out timestamps and mark as manual correction.
    async fn admin_set_attendance_session(
        &self,
        session_id: Uuid,
        check_in_at: Option<DateTime<Utc>>,
        check_out_at: Option<DateTime<Utc>>,
        manual_note: &str,
        updated_by: Uuid,
    ) -> Result<(), Error>;

    /// Delete a session (cascade deletes events) by user + work_date.
    async fn delete_attendance_session_by_user_date(
        &self,
        user_id: Uuid,
        work_date: NaiveDate,
    ) -> Result<u64, Error>;
}

#[async_trait]
impl AttendanceSessionRepo for DBClient {
    async fn upsert_attendance_session(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        work_date: NaiveDate,
    ) -> Result<Uuid, Error> {
        let row = sqlx::query!(
            r#"
            INSERT INTO attendance_sessions (satker_id, user_id, work_date)
            VALUES ($1, $2, $3)
            ON CONFLICT(user_id, work_date) DO UPDATE SET updated_at = NOW()
            RETURNING id
            "#,
            satker_id,
            user_id,
            work_date
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row.id)
    }

    async fn update_check_in_attendance_session(
        &self,
        session_id: Uuid,
        now: Option<DateTime<Utc>>,
    ) -> Result<UpdateAttendanceSession, Error> {
        let row = sqlx::query_as!(
            UpdateAttendanceSession,
            r#"
            UPDATE attendance_sessions
            SET check_in_at = COALESCE(check_in_at, $2),
                updated_at = now()
            WHERE id = $1
            RETURNING id, work_date, check_in_at, check_out_at
            "#,
            session_id,
            now
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    async fn update_check_out_attendance_session(
        &self,
        session_id: Uuid,
        now: Option<DateTime<Utc>>,
    ) -> Result<UpdateAttendanceSession, Error> {
        let row = sqlx::query_as!(
            UpdateAttendanceSession,
            r#"
            UPDATE attendance_sessions
            SET check_out_at = COALESCE(check_out_at, $2),
                status = 'CLOSED',
                updated_at = now()
            WHERE id = $1
            RETURNING id, work_date, check_in_at, check_out_at
            "#,
            session_id,
            now
        )
            .fetch_one(&self.pool)
            .await?;

        Ok(row)
    }

    async fn find_attendance_session(
        &self,
        session_id: Uuid,
    ) -> Result<RowAttendanceSession, Error> {
        let row = sqlx::query_as!(
            RowAttendanceSession,
            r#"
            SELECT check_in_at, check_out_at FROM attendance_sessions WHERE id = $1
            "#,
            session_id,
        )
            .fetch_one(&self.pool)
            .await?;

        Ok(row)
    }

    async fn admin_set_attendance_session(
        &self,
        session_id: Uuid,
        check_in_at: Option<DateTime<Utc>>,
        check_out_at: Option<DateTime<Utc>>,
        manual_note: &str,
        updated_by: Uuid,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
            UPDATE attendance_sessions
            SET
              check_in_at = $2,
              check_out_at = $3,
              status = CASE WHEN $3::timestamptz IS NULL THEN 'OPEN' ELSE 'CLOSED' END,
              is_manual = TRUE,
              manual_note = $4,
              manual_updated_by = $5,
              manual_updated_at = NOW(),
              updated_at = NOW()
            WHERE id = $1
            "#,
            session_id,
            check_in_at,
            check_out_at,
            manual_note,
            updated_by
        )
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    async fn delete_attendance_session_by_user_date(
        &self,
        user_id: Uuid,
        work_date: NaiveDate,
    ) -> Result<u64, Error> {
        let res = sqlx::query!(
            r#"DELETE FROM attendance_sessions WHERE user_id = $1 AND work_date = $2"#,
            user_id,
            work_date
        )
            .execute(&self.pool)
            .await?;

        Ok(res.rows_affected())
    }
}
