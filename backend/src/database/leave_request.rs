use crate::auth::rbac::UserRole;
use crate::constants::{LeaveStatus, LeaveType};
use crate::db::DBClient;
use crate::dtos::leave_request::{LeaveRequestDto, PendingLeaveDto};
use crate::models::{LeaveRequest, Satker};
use async_trait::async_trait;
use chrono::NaiveDate;
use sqlx::Error;
use uuid::Uuid;

#[async_trait]
pub trait LeaveRequestRepo {
    async fn create_leave_request(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        tipe: LeaveType,
        start_date: NaiveDate,
        end_date: NaiveDate,
        reason: Option<String>,
    ) -> Result<LeaveRequest, Error>;

    async fn list_leave_request_by_user_from_to(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error>;

    async fn list_pending_leave_all(&self) -> Result<Vec<PendingLeaveDto>, Error>;

    async fn list_pending_leave_by_satker(
        &self,
        satker_id: Uuid,
    ) -> Result<Vec<PendingLeaveDto>, Error>;

    async fn find_leave_request_by_id(&self, id: Uuid) -> Result<Option<LeaveRequest>, Error>;

    async fn approve_or_reject_leave(
        &self,
        leave_id: Uuid,
        approver_id: Uuid,
        leave_status: LeaveStatus,
        decision_note: Option<String>,
    ) -> Result<(), Error>;

    /// MEMBER: cancel own leave request (only when SUBMITTED)
    async fn cancel_leave_request_by_user(
        &self,
        leave_id: Uuid,
        user_id: Uuid,
        note: Option<String>,
    ) -> Result<u64, Error>;

    async fn list_leave_request_all_from_to(
        &self,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error>;

    async fn list_leave_request_by_satker_from_to(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error>;

    /// List leave requests that have been decided (APPROVED / REJECTED)
    async fn list_decided_leave_request_all_from_to(
        &self,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error>;

    /// List leave requests for a satker that have been decided (APPROVED / REJECTED)
    async fn list_decided_leave_request_by_satker_from_to(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error>;

    /// True if user has an APPROVED leave request covering the given date.
    async fn has_approved_leave_on_date(
        &self,
        user_id: Uuid,
        date: NaiveDate,
    ) -> Result<bool, Error>;
}

#[async_trait]
impl LeaveRequestRepo for DBClient {
    async fn create_leave_request(
        &self,
        satker_id: Uuid,
        user_id: Uuid,
        tipe: LeaveType,
        start_date: NaiveDate,
        end_date: NaiveDate,
        reason: Option<String>,
    ) -> Result<LeaveRequest, Error> {
        let row = sqlx::query_as!(
            LeaveRequest,
            r#"
            INSERT INTO leave_requests (satker_id, user_id, tipe, start_date, end_date, reason, status, submitted_at)
            VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', NOW())
            RETURNING
                id, satker_id, user_id, tipe as "tipe: LeaveType", start_date, end_date,
                reason, status as "status: LeaveStatus", submitted_at, decided_at, approver_id, decision_note,
                created_at, updated_at
            "#,
            satker_id,
            user_id,
            tipe as LeaveType,
            start_date,
            end_date,
            reason,
        ).fetch_one(&self.pool).await?;

        Ok(row)
    }

    async fn cancel_leave_request_by_user(
        &self,
        leave_id: Uuid,
        user_id: Uuid,
        note: Option<String>,
    ) -> Result<u64, Error> {
        let note = note.filter(|s| !s.trim().is_empty());
        let note = note.or_else(|| Some("Dibatalkan oleh pemohon".to_string()));

        let result = sqlx::query!(
            r#"
            UPDATE leave_requests
            SET
                status = 'CANCELLED',
                decided_at = NOW(),
                approver_id = NULL,
                decision_note = $3,
                updated_at = NOW()
            WHERE id = $1
              AND user_id = $2
              AND status = 'SUBMITTED'
            "#,
            leave_id,
            user_id,
            note
        )
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected())
    }

    async fn list_leave_request_by_user_from_to(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error> {
        let rows = sqlx::query_as!(
            LeaveRequestDto,
            r#"
            SELECT
                lr.id,
                s.name AS satker_name,
                s.id AS satker_id,
                s.code AS satker_code,
                u.full_name AS user_full_name,
                u.id AS user_id,
                u.nrp AS user_nrp,
                u.role AS "role: UserRole",
                u.phone AS user_phone,
                lr.tipe AS "tipe: LeaveType",
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.status AS "status: LeaveStatus",
                lr.submitted_at,
                lr.decided_at,
                a.full_name AS "approver_full_name?",
                a.id AS "approver_id?",
                a.nrp AS "approver_nrp?",
                a.role AS "approver_role?: UserRole",
                a.phone AS "approver_phone?",
                lr.decision_note,
                lr.created_at,
                lr.updated_at
                FROM leave_requests lr
                JOIN users u ON lr.user_id=u.id
                JOIN satkers s ON lr.satker_id=s.id
                LEFT JOIN users a ON lr.approver_id=a.id
                WHERE
                    lr.user_id = $1 AND
                    lr.start_date >= $2 AND
                    lr.end_date <= $3
                ORDER BY lr.created_at DESC
            "#,
            user_id,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn list_leave_request_all_from_to(
        &self,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error> {
        let rows = sqlx::query_as!(
            LeaveRequestDto,
            r#"
            SELECT
                lr.id,
                s.name AS satker_name,
                s.id AS satker_id,
                s.code AS satker_code,
                u.full_name AS user_full_name,
                u.id AS user_id,
                u.nrp AS user_nrp,
                u.role AS "role: UserRole",
                u.phone AS user_phone,
                lr.tipe AS "tipe: LeaveType",
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.status AS "status: LeaveStatus",
                lr.submitted_at,
                lr.decided_at,
                a.full_name AS "approver_full_name?",
                a.id AS "approver_id?",
                a.nrp AS "approver_nrp?",
                a.role AS "approver_role?: UserRole",
                a.phone AS "approver_phone?",
                lr.decision_note,
                lr.created_at,
                lr.updated_at
                FROM leave_requests lr
                JOIN users u ON lr.user_id=u.id
                JOIN satkers s ON lr.satker_id=s.id
                LEFT JOIN users a ON lr.approver_id=a.id
                WHERE
                    lr.start_date >= $1 AND
                    lr.end_date <= $2
                ORDER BY lr.created_at DESC
            "#,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn list_leave_request_by_satker_from_to(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error> {
        let rows = sqlx::query_as!(
            LeaveRequestDto,
            r#"
            SELECT
                lr.id,
                s.name AS satker_name,
                s.id AS satker_id,
                s.code AS satker_code,
                u.full_name AS user_full_name,
                u.id AS user_id,
                u.nrp AS user_nrp,
                u.role AS "role: UserRole",
                u.phone AS user_phone,
                lr.tipe AS "tipe: LeaveType",
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.status AS "status: LeaveStatus",
                lr.submitted_at,
                lr.decided_at,
                a.full_name AS "approver_full_name?",
                a.id AS "approver_id?",
                a.nrp AS "approver_nrp?",
                a.role AS "approver_role?: UserRole",
                a.phone AS "approver_phone?",
                lr.decision_note,
                lr.created_at,
                lr.updated_at
                FROM leave_requests lr
                JOIN users u ON lr.user_id=u.id
                JOIN satkers s ON lr.satker_id=s.id
                LEFT JOIN users a ON lr.approver_id=a.id
                WHERE
                    lr.satker_id = $1 AND
                    lr.start_date >= $2 AND
                    lr.end_date <= $3
                ORDER BY lr.created_at DESC
            "#,
            satker_id,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn list_pending_leave_all(&self) -> Result<Vec<PendingLeaveDto>, Error> {
        let rows = sqlx::query_as!(
            PendingLeaveDto,
            r#"
            SELECT
              lr.id,
              lr.satker_id,
              s.code AS satker_code,
              s.name AS satker_name,
              lr.user_id,
              u.full_name as requester_name,
              u.nrp as requester_nrp,
              lr.tipe as "tipe: LeaveType",
              lr.start_date, lr.end_date, lr.reason,
              lr.status as "status: LeaveStatus",
              lr.submitted_at, lr.created_at
            FROM leave_requests lr
            JOIN users u ON u.id = lr.user_id
            JOIN satkers s ON s.id = lr.satker_id
            WHERE
                lr.status = 'SUBMITTED'
            ORDER BY lr.created_at ASC
            "#
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    async fn list_pending_leave_by_satker(
        &self,
        satker_id: Uuid,
    ) -> Result<Vec<PendingLeaveDto>, Error> {
        let rows = sqlx::query_as!(
            PendingLeaveDto,
            r#"
            SELECT
              lr.id,
              lr.satker_id,
              s.code AS satker_code,
              s.name AS satker_name,
              lr.user_id,
              u.full_name as requester_name,
              u.nrp as requester_nrp,
              lr.tipe as "tipe: LeaveType",
              lr.start_date, lr.end_date, lr.reason,
              lr.status as "status: LeaveStatus",
              lr.submitted_at, lr.created_at
            FROM leave_requests lr
            JOIN users u ON u.id = lr.user_id
            JOIN satkers s ON s.id = lr.satker_id
            WHERE
                lr.status = 'SUBMITTED' AND
                lr.satker_id = $1
            ORDER BY lr.created_at ASC
            "#,
            satker_id
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(rows)
    }

    async fn find_leave_request_by_id(&self, id: Uuid) -> Result<Option<LeaveRequest>, Error> {
        let row = sqlx::query_as!(
            LeaveRequest,
            r#"
            SELECT id, satker_id, user_id, tipe as "tipe: LeaveType", start_date, end_date,
                reason, status as "status: LeaveStatus", submitted_at, decided_at, approver_id, decision_note,
                created_at, updated_at
            FROM leave_requests
            WHERE
                id = $1
            "#,
            id
        ).fetch_optional(&self.pool).await?;

        Ok(row)
    }

    async fn approve_or_reject_leave(
        &self,
        leave_id: Uuid,
        approver_id: Uuid,
        leave_status: LeaveStatus,
        decision_note: Option<String>,
    ) -> Result<(), Error> {
        sqlx::query!(
            r#"
                UPDATE leave_requests
                SET status = $2,
                    approver_id = $3,
                    decided_at = now(),
                    decision_note = $4
                WHERE id = $1
            "#,
            leave_id,
            leave_status as LeaveStatus,
            approver_id,
            decision_note,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    async fn list_decided_leave_request_all_from_to(
        &self,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error> {
        let rows = sqlx::query_as!(
            LeaveRequestDto,
            r#"
            SELECT
                lr.id,
                s.name AS satker_name,
                s.id AS satker_id,
                s.code AS satker_code,
                u.full_name AS user_full_name,
                u.id AS user_id,
                u.nrp AS user_nrp,
                u.role AS "role: UserRole",
                u.phone AS user_phone,
                lr.tipe AS "tipe: LeaveType",
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.status AS "status: LeaveStatus",
                lr.submitted_at,
                lr.decided_at,
                a.full_name AS "approver_full_name?",
                a.id AS "approver_id?",
                a.nrp AS "approver_nrp?",
                a.role AS "approver_role?: UserRole",
                a.phone AS "approver_phone?",
                lr.decision_note,
                lr.created_at,
                lr.updated_at
            FROM leave_requests lr
            JOIN users u ON lr.user_id=u.id
            JOIN satkers s ON lr.satker_id=s.id
            LEFT JOIN users a ON lr.approver_id=a.id
            WHERE
                lr.status IN ('APPROVED','REJECTED') AND
                lr.start_date >= $1 AND
                lr.end_date <= $2
            ORDER BY lr.decided_at DESC NULLS LAST, lr.created_at DESC
            "#,
            from,
            to
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(rows)
    }

    async fn list_decided_leave_request_by_satker_from_to(
        &self,
        satker_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveRequestDto>, Error> {
        let rows = sqlx::query_as!(
            LeaveRequestDto,
            r#"
            SELECT
                lr.id,
                s.name AS satker_name,
                s.id AS satker_id,
                s.code AS satker_code,
                u.full_name AS user_full_name,
                u.id AS user_id,
                u.nrp AS user_nrp,
                u.role AS "role: UserRole",
                u.phone AS user_phone,
                lr.tipe AS "tipe: LeaveType",
                lr.start_date,
                lr.end_date,
                lr.reason,
                lr.status AS "status: LeaveStatus",
                lr.submitted_at,
                lr.decided_at,
                a.full_name AS "approver_full_name?",
                a.id AS "approver_id?",
                a.nrp AS "approver_nrp?",
                a.role AS "approver_role?: UserRole",
                a.phone AS "approver_phone?",
                lr.decision_note,
                lr.created_at,
                lr.updated_at
            FROM leave_requests lr
            JOIN users u ON lr.user_id=u.id
            JOIN satkers s ON lr.satker_id=s.id
            LEFT JOIN users a ON lr.approver_id=a.id
            WHERE
                lr.status IN ('APPROVED','REJECTED') AND
                lr.satker_id = $1 AND
                lr.start_date >= $2 AND
                lr.end_date <= $3
            ORDER BY lr.decided_at DESC NULLS LAST, lr.created_at DESC
            "#,
            satker_id,
            from,
            to
        )
            .fetch_all(&self.pool)
            .await?;

        Ok(rows)
    }

    async fn has_approved_leave_on_date(
        &self,
        user_id: Uuid,
        date: NaiveDate,
    ) -> Result<bool, Error> {
        let row = sqlx::query!(
            r#"
            SELECT 1 as one
            FROM leave_requests
            WHERE user_id = $1
              AND status = 'APPROVED'
              AND start_date <= $2
              AND end_date >= $2
            LIMIT 1
            "#,
            user_id,
            date
        )
            .fetch_optional(&self.pool)
            .await?;

        Ok(row.is_some())
    }
}
