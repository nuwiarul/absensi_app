use async_trait::async_trait;
use chrono::{DateTime, NaiveDate, Utc};
use serde_json::Value as JsonValue;
use sqlx::Error;
use uuid::Uuid;

use crate::constants::{AttendanceEventType, LeaveStatus, LeaveType};
use crate::db::DBClient;
use crate::dtos::tukin::{
    CreateTukinPolicyReq, LeaveRuleInput, TukinCalculationDto, TukinCalculationRowDto,
    TukinLeaveRuleDto, TukinPolicyDto, UpdateTukinPolicyReq,
};

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct LeaveSpanRow {
    pub tipe: LeaveType,
    pub start_date: NaiveDate,
    pub end_date: NaiveDate,
}

#[derive(Debug, Clone, sqlx::FromRow)]
pub struct AttendanceEventLite {
    pub occurred_at: DateTime<Utc>,
    pub geofence_id: Option<Uuid>,
    pub distance_to_fence_m: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct TukinCalculationUpsert {
    pub month: NaiveDate,
    pub satker_id: Uuid,
    pub user_id: Uuid,
    pub policy_id: Uuid,

    pub base_tukin: i64,
    pub expected_units: f64,
    pub earned_credit: f64,
    pub attendance_ratio: f64,
    pub final_tukin: i64,

    pub breakdown: JsonValue,
}

#[async_trait]
pub trait TukinRepo {
    // rules
    async fn find_active_tukin_policy(
        &self,
        satker_id: Uuid,
        period_start: NaiveDate,
    ) -> Result<TukinPolicyDto, Error>;
    async fn list_tukin_policies(
        &self,
        satker_id: Option<Uuid>,
    ) -> Result<Vec<TukinPolicyDto>, Error>;
    async fn create_tukin_policy(&self, req: CreateTukinPolicyReq)
    -> Result<TukinPolicyDto, Error>;
    async fn update_tukin_policy(
        &self,
        policy_id: Uuid,
        req: UpdateTukinPolicyReq,
    ) -> Result<TukinPolicyDto, Error>;

    async fn list_leave_rules(&self, policy_id: Uuid) -> Result<Vec<TukinLeaveRuleDto>, Error>;
    async fn replace_leave_rules(
        &self,
        policy_id: Uuid,
        rules: Vec<LeaveRuleInput>,
    ) -> Result<Vec<TukinLeaveRuleDto>, Error>;

    // base
    async fn get_user_base_tukin(&self, user_id: Uuid) -> Result<i64, Error>;

    // data
    async fn list_approved_leaves_by_user(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveSpanRow>, Error>;
    async fn find_first_event_in_range(
        &self,
        user_id: Uuid,
        event_type: AttendanceEventType,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Option<AttendanceEventLite>, Error>;
    async fn find_last_event_in_range(
        &self,
        user_id: Uuid,
        event_type: AttendanceEventType,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Option<AttendanceEventLite>, Error>;

    // cache
    async fn upsert_tukin_calculation(
        &self,
        row: TukinCalculationUpsert,
    ) -> Result<TukinCalculationDto, Error>;
    async fn list_tukin_calculations(
        &self,
        month: NaiveDate,
        satker_id: Option<Uuid>,
        user_id: Option<Uuid>,
    ) -> Result<Vec<TukinCalculationRowDto>, Error>;

    async fn delete_tukin_policy(&self, policy_id: Uuid) -> Result<(), Error>;
}

#[async_trait]
impl TukinRepo for DBClient {
    /*async fn find_active_tukin_policy(&self, satker_id: Uuid, period_start: NaiveDate) -> Result<TukinPolicyDto, Error> {
        // 1) SATKER policy (most recent effective_from)
        if let Some(row) = sqlx::query_as!(
            TukinPolicyDto,
            r#"
            SELECT
              id,
              scope,
              satker_id,
              effective_from,
              effective_to,
              missing_checkout_penalty_pct::float8 as "missing_checkout_penalty_pct!",
              late_tolerance_minutes,
              late_penalty_per_minute_pct::float8 as "late_penalty_per_minute_pct!",
              max_daily_penalty_pct::float8 as "max_daily_penalty_pct!",
              out_of_geofence_penalty_pct::float8 as "out_of_geofence_penalty_pct!",
              created_at,
              updated_at
            FROM tukin_policies
            WHERE scope = 'SATKER'
              AND satker_id = $1
              AND effective_from <= $2
              AND (effective_to IS NULL OR effective_to >= $2)
            ORDER BY effective_from DESC
            LIMIT 1
            "#,
            satker_id,
            period_start
        )
            .fetch_optional(&self.pool)
            .await? {
            return Ok(row);
        }

        // 2) GLOBAL policy
        let row = sqlx::query_as!(
            TukinPolicyDto,
            r#"
            SELECT
              id,
              scope,
              satker_id,
              effective_from,
              effective_to,
              missing_checkout_penalty_pct::float8 as "missing_checkout_penalty_pct!",
              late_tolerance_minutes,
              late_penalty_per_minute_pct::float8 as "late_penalty_per_minute_pct!",
              max_daily_penalty_pct::float8 as "max_daily_penalty_pct!",
              out_of_geofence_penalty_pct::float8 as "out_of_geofence_penalty_pct!",
              created_at,
              updated_at
            FROM tukin_policies
            WHERE scope = 'GLOBAL'
              AND effective_from <= $1
              AND (effective_to IS NULL OR effective_to >= $1)
            ORDER BY effective_from DESC
            LIMIT 1
            "#,
            period_start
        )
            .fetch_one(&self.pool)
            .await?;

        Ok(row)
    }*/

    async fn find_active_tukin_policy(
        &self,
        satker_id: Uuid,
        period_start: NaiveDate,
    ) -> Result<TukinPolicyDto, Error> {
        // 1) SATKER policy (most recent effective_from)
        if let Some(row) = sqlx::query_as!(
            TukinPolicyDto,
            r#"
        SELECT
          p.id,
          p.scope,
          p.satker_id,
          s.code as "satker_code?",
          s.name as "satker_name?",
          p.effective_from,
          p.effective_to,
          p.missing_checkout_penalty_pct::float8 as "missing_checkout_penalty_pct!",
          p.late_tolerance_minutes,
          p.late_penalty_per_minute_pct::float8 as "late_penalty_per_minute_pct!",
          p.max_daily_penalty_pct::float8 as "max_daily_penalty_pct!",
          p.out_of_geofence_penalty_pct::float8 as "out_of_geofence_penalty_pct!",
          p.created_at,
          p.updated_at
        FROM tukin_policies p
        LEFT JOIN satkers s ON s.id = p.satker_id
        WHERE p.scope = 'SATKER'
          AND p.satker_id = $1
          AND p.effective_from <= $2
          AND (p.effective_to IS NULL OR p.effective_to >= $2)
        ORDER BY p.effective_from DESC, p.created_at DESC
        LIMIT 1
        "#,
            satker_id,
            period_start
        )
        .fetch_optional(&self.pool)
        .await?
        {
            return Ok(row);
        }

        // 2) GLOBAL policy
        let row = sqlx::query_as!(
            TukinPolicyDto,
            r#"
        SELECT
          p.id,
          p.scope,
          p.satker_id,
          s.code as "satker_code?",
          s.name as "satker_name?",
          p.effective_from,
          p.effective_to,
          p.missing_checkout_penalty_pct::float8 as "missing_checkout_penalty_pct!",
          p.late_tolerance_minutes,
          p.late_penalty_per_minute_pct::float8 as "late_penalty_per_minute_pct!",
          p.max_daily_penalty_pct::float8 as "max_daily_penalty_pct!",
          p.out_of_geofence_penalty_pct::float8 as "out_of_geofence_penalty_pct!",
          p.created_at,
          p.updated_at
        FROM tukin_policies p
        LEFT JOIN satkers s ON s.id = p.satker_id
        WHERE p.scope = 'GLOBAL'
          AND p.effective_from <= $1
          AND (p.effective_to IS NULL OR p.effective_to >= $1)
        ORDER BY p.effective_from DESC, p.created_at DESC
        LIMIT 1
        "#,
            period_start
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    async fn list_tukin_policies(
        &self,
        satker_id: Option<Uuid>,
    ) -> Result<Vec<TukinPolicyDto>, Error> {
        // Return GLOBAL + optionally SATKER.
        let rows = sqlx::query_as!(
            TukinPolicyDto,
            r#"
            SELECT
          p.id,
          p.scope,
          p.satker_id,

          -- ✅ NEW
          s.code as "satker_code?",
          s.name as "satker_name?",

          p.effective_from,
          p.effective_to,
          p.missing_checkout_penalty_pct::float8 as "missing_checkout_penalty_pct!",
          p.late_tolerance_minutes,
          p.late_penalty_per_minute_pct::float8 as "late_penalty_per_minute_pct!",
          p.max_daily_penalty_pct::float8 as "max_daily_penalty_pct!",
          p.out_of_geofence_penalty_pct::float8 as "out_of_geofence_penalty_pct!",
          p.created_at,
          p.updated_at
        FROM tukin_policies p
        LEFT JOIN satkers s ON s.id = p.satker_id
        WHERE p.scope='GLOBAL'
           OR (p.scope='SATKER' AND ($1::uuid IS NULL OR p.satker_id = $1))
        ORDER BY
          p.scope ASC,
          p.satker_id NULLS FIRST,
          p.created_at DESC
            "#,
            satker_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    /*async fn create_tukin_policy(&self, req: CreateTukinPolicyReq) -> Result<TukinPolicyDto, Error> {
        let row = sqlx::query_as!(
            TukinPolicyDto,
            r#"
            INSERT INTO tukin_policies (
              scope,
              satker_id,
              effective_from,
              effective_to,
              missing_checkout_penalty_pct,
              late_tolerance_minutes,
              late_penalty_per_minute_pct,
              max_daily_penalty_pct,
              out_of_geofence_penalty_pct
            ) VALUES (
              $1,
              $2,
              $3,
              $4,
              COALESCE($5, 25.0::DOUBLE PRECISION),
              COALESCE($6, 0),
              COALESCE($7, 0.0::DOUBLE PRECISION),
              COALESCE($8, 100.0::DOUBLE PRECISION),
              COALESCE($9, 0.0::DOUBLE PRECISION)
            )
            RETURNING
              id,
              scope,
              satker_id,
              effective_from,
              effective_to,
              missing_checkout_penalty_pct::DOUBLE PRECISION as "missing_checkout_penalty_pct!",
              late_tolerance_minutes,
              late_penalty_per_minute_pct::DOUBLE PRECISION as "late_penalty_per_minute_pct!",
              max_daily_penalty_pct::DOUBLE PRECISION as "max_daily_penalty_pct!",
              out_of_geofence_penalty_pct::DOUBLE PRECISION as "out_of_geofence_penalty_pct!",
              created_at,
              updated_at
            "#,
            req.scope,
            req.satker_id,
            req.effective_from,
            req.effective_to,
            req.missing_checkout_penalty_pct,
            req.late_tolerance_minutes,
            req.late_penalty_per_minute_pct,
            req.max_daily_penalty_pct,
            req.out_of_geofence_penalty_pct
        )
            .fetch_one(&self.pool)
            .await?;

        Ok(row)
    }*/

    async fn create_tukin_policy(
        &self,
        req: CreateTukinPolicyReq,
    ) -> Result<TukinPolicyDto, Error> {
        let rec = sqlx::query!(
            r#"
        INSERT INTO tukin_policies (
          scope,
          satker_id,
          effective_from,
          effective_to,
          missing_checkout_penalty_pct,
          late_tolerance_minutes,
          late_penalty_per_minute_pct,
          max_daily_penalty_pct,
          out_of_geofence_penalty_pct
        ) VALUES (
          $1,
          $2,
          $3,
          $4,
          COALESCE($5, 25.0::DOUBLE PRECISION),
          COALESCE($6, 0),
          COALESCE($7, 0.0::DOUBLE PRECISION),
          COALESCE($8, 100.0::DOUBLE PRECISION),
          COALESCE($9, 0.0::DOUBLE PRECISION)
        )
        RETURNING id
        "#,
            req.scope,
            req.satker_id,
            req.effective_from,
            req.effective_to,
            req.missing_checkout_penalty_pct,
            req.late_tolerance_minutes,
            req.late_penalty_per_minute_pct,
            req.max_daily_penalty_pct,
            req.out_of_geofence_penalty_pct
        )
        .fetch_one(&self.pool)
        .await?;

        let row = sqlx::query_as!(
            TukinPolicyDto,
            r#"
        SELECT
          p.id,
          p.scope,
          p.satker_id,
          s.code as "satker_code?",
          s.name as "satker_name?",
          p.effective_from,
          p.effective_to,
          p.missing_checkout_penalty_pct::float8 as "missing_checkout_penalty_pct!",
          p.late_tolerance_minutes,
          p.late_penalty_per_minute_pct::float8 as "late_penalty_per_minute_pct!",
          p.max_daily_penalty_pct::float8 as "max_daily_penalty_pct!",
          p.out_of_geofence_penalty_pct::float8 as "out_of_geofence_penalty_pct!",
          p.created_at,
          p.updated_at
        FROM tukin_policies p
        LEFT JOIN satkers s ON s.id = p.satker_id
        WHERE p.id = $1
        "#,
            rec.id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    /*async fn update_tukin_policy(&self, policy_id: Uuid, req: UpdateTukinPolicyReq) -> Result<TukinPolicyDto, Error> {
        let row = sqlx::query_as!(
            TukinPolicyDto,
            r#"
            UPDATE tukin_policies
            SET
              effective_from = $2,
              effective_to = $3,
              missing_checkout_penalty_pct = $4::DOUBLE PRECISION,
              late_tolerance_minutes = $5,
              late_penalty_per_minute_pct = $6,
              max_daily_penalty_pct = $7,
              out_of_geofence_penalty_pct = $8,
              updated_at = now()
            WHERE id = $1
            RETURNING
              id,
              scope,
              satker_id,
              effective_from,
              effective_to,
              missing_checkout_penalty_pct::float8 as "missing_checkout_penalty_pct!",
              late_tolerance_minutes,
              late_penalty_per_minute_pct::float8 as "late_penalty_per_minute_pct!",
              max_daily_penalty_pct::float8 as "max_daily_penalty_pct!",
              out_of_geofence_penalty_pct::float8 as "out_of_geofence_penalty_pct!",
              created_at,
              updated_at
            "#,
            policy_id,
            req.effective_from,
            req.effective_to,
            req.missing_checkout_penalty_pct,
            req.late_tolerance_minutes,
            req.late_penalty_per_minute_pct,
            req.max_daily_penalty_pct,
            req.out_of_geofence_penalty_pct
        )
            .fetch_one(&self.pool)
            .await?;

        Ok(row)
    }*/

    async fn update_tukin_policy(
        &self,
        policy_id: Uuid,
        req: UpdateTukinPolicyReq,
    ) -> Result<TukinPolicyDto, Error> {
        let rec = sqlx::query!(
            r#"
        UPDATE tukin_policies
        SET
          effective_from = $2,
          effective_to = $3,
          missing_checkout_penalty_pct = $4::DOUBLE PRECISION,
          late_tolerance_minutes = $5,
          late_penalty_per_minute_pct = $6,
          max_daily_penalty_pct = $7,
          out_of_geofence_penalty_pct = $8,
          updated_at = now()
        WHERE id = $1
        RETURNING id
        "#,
            policy_id,
            req.effective_from,
            req.effective_to,
            req.missing_checkout_penalty_pct,
            req.late_tolerance_minutes,
            req.late_penalty_per_minute_pct,
            req.max_daily_penalty_pct,
            req.out_of_geofence_penalty_pct
        )
        .fetch_one(&self.pool)
        .await?;

        let row = sqlx::query_as!(
            TukinPolicyDto,
            r#"
        SELECT
          p.id,
          p.scope,
          p.satker_id,
          s.code as "satker_code?",
          s.name as "satker_name?",
          p.effective_from,
          p.effective_to,
          p.missing_checkout_penalty_pct::float8 as "missing_checkout_penalty_pct!",
          p.late_tolerance_minutes,
          p.late_penalty_per_minute_pct::float8 as "late_penalty_per_minute_pct!",
          p.max_daily_penalty_pct::float8 as "max_daily_penalty_pct!",
          p.out_of_geofence_penalty_pct::float8 as "out_of_geofence_penalty_pct!",
          p.created_at,
          p.updated_at
        FROM tukin_policies p
        LEFT JOIN satkers s ON s.id = p.satker_id
        WHERE p.id = $1
        "#,
            rec.id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row)
    }

    async fn list_leave_rules(&self, policy_id: Uuid) -> Result<Vec<TukinLeaveRuleDto>, Error> {
        let rows = sqlx::query_as!(
            TukinLeaveRuleDto,
            r#"
            SELECT
              policy_id,
              leave_type as "leave_type: LeaveType",
              credit::float8 as "credit!",
              counts_as_present
            FROM tukin_leave_type_rules
            WHERE policy_id = $1
            ORDER BY leave_type ASC
            "#,
            policy_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn replace_leave_rules(
        &self,
        policy_id: Uuid,
        rules: Vec<LeaveRuleInput>,
    ) -> Result<Vec<TukinLeaveRuleDto>, Error> {
        let mut tx = self.pool.begin().await?;

        sqlx::query!(
            r#"DELETE FROM tukin_leave_type_rules WHERE policy_id = $1"#,
            policy_id
        )
        .execute(&mut *tx)
        .await?;

        for r in rules {
            sqlx::query!(
                r#"
                INSERT INTO tukin_leave_type_rules (policy_id, leave_type, credit, counts_as_present)
                VALUES ($1, $2, $3::DOUBLE PRECISION, $4)
                "#,
                policy_id,
                r.leave_type as LeaveType,
                r.credit,
                r.counts_as_present
            )
                .execute(&mut *tx)
                .await?;
        }

        tx.commit().await?;

        self.list_leave_rules(policy_id).await
    }

    async fn get_user_base_tukin(&self, user_id: Uuid) -> Result<i64, Error> {
        let row = sqlx::query!(
            r#"
            SELECT COALESCE(r.tukin_base, 0) as tukin_base
            FROM users u
            LEFT JOIN ranks r ON u.rank_id = r.id
            WHERE u.id = $1
            "#,
            user_id
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(row.tukin_base.unwrap_or(0))
    }

    async fn list_approved_leaves_by_user(
        &self,
        user_id: Uuid,
        from: NaiveDate,
        to: NaiveDate,
    ) -> Result<Vec<LeaveSpanRow>, Error> {
        let rows = sqlx::query_as!(
            LeaveSpanRow,
            r#"
            SELECT
              tipe as "tipe: LeaveType",
              start_date,
              end_date
            FROM leave_requests
            WHERE user_id = $1
              AND status = $2
              AND NOT (end_date < $3 OR start_date > $4)
            "#,
            user_id,
            LeaveStatus::Approved as LeaveStatus,
            from,
            to
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn find_first_event_in_range(
        &self,
        user_id: Uuid,
        event_type: AttendanceEventType,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Option<AttendanceEventLite>, Error> {
        let row = sqlx::query_as!(
            AttendanceEventLite,
            r#"
            SELECT occurred_at, geofence_id, distance_to_fence_m
            FROM attendance_events
            WHERE user_id = $1
              AND event_type = $2
              AND occurred_at >= $3
              AND occurred_at <= $4
            ORDER BY occurred_at ASC
            LIMIT 1
            "#,
            user_id,
            event_type as AttendanceEventType,
            from,
            to
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    async fn find_last_event_in_range(
        &self,
        user_id: Uuid,
        event_type: AttendanceEventType,
        from: DateTime<Utc>,
        to: DateTime<Utc>,
    ) -> Result<Option<AttendanceEventLite>, Error> {
        let row = sqlx::query_as!(
            AttendanceEventLite,
            r#"
            SELECT occurred_at, geofence_id, distance_to_fence_m
            FROM attendance_events
            WHERE user_id = $1
              AND event_type = $2
              AND occurred_at >= $3
              AND occurred_at <= $4
            ORDER BY occurred_at DESC
            LIMIT 1
            "#,
            user_id,
            event_type as AttendanceEventType,
            from,
            to
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(row)
    }

    async fn upsert_tukin_calculation(
        &self,
        row: TukinCalculationUpsert,
    ) -> Result<TukinCalculationDto, Error> {
        let rec = sqlx::query_as!(
            TukinCalculationDto,
            r#"
            INSERT INTO tukin_calculations (
              month, satker_id, user_id, policy_id,
              base_tukin, expected_units, earned_credit, attendance_ratio, final_tukin,
              breakdown
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7, $8, $9,
              $10
            )
            ON CONFLICT (month, user_id) DO UPDATE
            SET
              satker_id = EXCLUDED.satker_id,
              policy_id = EXCLUDED.policy_id,
              base_tukin = EXCLUDED.base_tukin,
              expected_units = EXCLUDED.expected_units,
              earned_credit = EXCLUDED.earned_credit,
              attendance_ratio = EXCLUDED.attendance_ratio,
              final_tukin = EXCLUDED.final_tukin,
              breakdown = EXCLUDED.breakdown,
              updated_at = now()
            RETURNING
              id,
              month,
              satker_id,
              user_id,
              policy_id,
              base_tukin,
              expected_units,
              earned_credit,
              attendance_ratio,
              final_tukin,
              breakdown as "breakdown: JsonValue",
              created_at,
              updated_at
            "#,
            row.month,
            row.satker_id,
            row.user_id,
            row.policy_id,
            row.base_tukin,
            row.expected_units,
            row.earned_credit,
            row.attendance_ratio,
            row.final_tukin,
            row.breakdown
        )
        .fetch_one(&self.pool)
        .await?;

        Ok(rec)
    }

    async fn list_tukin_calculations(
        &self,
        month: NaiveDate,
        satker_id: Option<Uuid>,
        user_id: Option<Uuid>,
    ) -> Result<Vec<TukinCalculationRowDto>, Error> {
        let rows = sqlx::query_as!(
            TukinCalculationRowDto,
            r#"
            SELECT
              to_char(tc.month, 'YYYY-MM') as "month!",
              tc.satker_id,
              st.code as "satker_code?",
              st.name as "satker_name?",

              tc.user_id,
              u.full_name as "user_full_name!",
              u.nrp as "user_nrp!",

              r.code as "rank_code?",
              r.name as "rank_name?",

              tc.base_tukin,
              tc.expected_units,
              tc.earned_credit,
              tc.attendance_ratio,
              tc.final_tukin,

              tc.breakdown as "breakdown: JsonValue",
              tc.updated_at
            FROM tukin_calculations tc
            JOIN users u ON u.id = tc.user_id
            JOIN satkers st ON st.id = tc.satker_id
            LEFT JOIN ranks r ON r.id = u.rank_id
            WHERE tc.month = $1
              AND ($2::uuid IS NULL OR tc.satker_id = $2)
              AND ($3::uuid IS NULL OR tc.user_id = $3)
            ORDER BY tc.final_tukin DESC, tc.user_id ASC
            "#,
            month,
            satker_id,
            user_id
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(rows)
    }

    async fn delete_tukin_policy(&self, policy_id: Uuid) -> Result<(), Error> {
        sqlx::query!(r#"DELETE FROM tukin_policies WHERE id = $1"#, policy_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}
