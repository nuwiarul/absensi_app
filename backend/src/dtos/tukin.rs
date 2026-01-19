use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use uuid::Uuid;

use crate::constants::LeaveType;

#[derive(Debug, Deserialize)]
pub struct TukinPreviewQuery {
    /// Format: YYYY-MM
    pub month: String,
    pub satker_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct TukinGenerateQuery {
    /// Format: YYYY-MM
    pub month: String,
    pub satker_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub force: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct TukinCalculationsQuery {
    /// Format: YYYY-MM
    pub month: String,
    pub satker_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
}

#[derive(Debug, Serialize, sqlx::FromRow, Clone)]
pub struct TukinPolicyDto {
    pub id: Uuid,
    pub scope: String,
    pub satker_id: Option<Uuid>,
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,

    pub missing_checkout_penalty_pct: f64,
    pub late_tolerance_minutes: i32,
    pub late_penalty_per_minute_pct: f64,
    pub max_daily_penalty_pct: f64,
    pub out_of_geofence_penalty_pct: f64,

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTukinPolicyReq {
    /// GLOBAL atau SATKER
    pub scope: String,
    pub satker_id: Option<Uuid>,

    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,

    pub missing_checkout_penalty_pct: Option<f64>,
    pub late_tolerance_minutes: Option<i32>,
    pub late_penalty_per_minute_pct: Option<f64>,
    pub max_daily_penalty_pct: Option<f64>,
    pub out_of_geofence_penalty_pct: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateTukinPolicyReq {
    pub effective_from: NaiveDate,
    pub effective_to: Option<NaiveDate>,

    pub missing_checkout_penalty_pct: f64,
    pub late_tolerance_minutes: i32,
    pub late_penalty_per_minute_pct: f64,
    pub max_daily_penalty_pct: f64,
    pub out_of_geofence_penalty_pct: f64,
}

#[derive(Debug, Serialize, sqlx::FromRow, Clone)]
pub struct TukinLeaveRuleDto {
    pub policy_id: Uuid,
    pub leave_type: LeaveType,
    pub credit: f64,
    pub counts_as_present: bool,
}

#[derive(Debug, Deserialize)]
pub struct LeaveRuleInput {
    pub leave_type: LeaveType,
    pub credit: f64,
    pub counts_as_present: bool,
}

#[derive(Debug, Deserialize)]
pub struct ReplaceLeaveRulesReq {
    pub rules: Vec<LeaveRuleInput>,
}

#[derive(Debug, Serialize, Clone)]
pub struct TukinDayBreakdownDto {
    pub work_date: NaiveDate,
    pub expected_unit: f64,
    pub earned_credit: f64,

    pub is_duty_schedule: bool,
    pub duty_schedule_id: Option<Uuid>,

    pub check_in_at: Option<DateTime<Utc>>,
    pub check_out_at: Option<DateTime<Utc>>,
    pub late_minutes: Option<i64>,

    pub leave_type: Option<LeaveType>,
    pub leave_credit: Option<f64>,

    pub note: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
pub struct TukinUserSummaryDto {
    pub user_id: Uuid,
    pub satker_id: Uuid,
    pub nrp: String,
    pub full_name: String,

    pub month: String,

    pub policy_id: Uuid,
    pub base_tukin: i64,
    pub expected_units: f64,
    pub earned_credit: f64,
    pub attendance_ratio: f64,
    pub final_tukin: i64,

    pub present_days: i32,
    pub absent_days: i32,
    pub missing_checkout_days: i32,
    pub duty_present: i32,
    pub duty_absent: i32,

    pub total_late_minutes: i64,

    pub days: Vec<TukinDayBreakdownDto>,
}

#[derive(Debug, Serialize)]
pub struct TukinPreviewResp {
    pub status: &'static str,
    pub data: Vec<TukinUserSummaryDto>,
}

#[derive(Debug, Serialize, sqlx::FromRow, Clone)]
pub struct TukinCalculationDto {
    pub id: Uuid,
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

    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Row DTO khusus untuk tabel laporan (cache bulanan) + detail breakdown.
/// Denormalized agar frontend tidak perlu N+1 fetch.
#[derive(Debug, Serialize, sqlx::FromRow, Clone)]
pub struct TukinCalculationRowDto {
    pub month: String, // YYYY-MM

    pub satker_id: Uuid,
    pub satker_code: Option<String>,
    pub satker_name: Option<String>,

    pub user_id: Uuid,
    pub user_full_name: String,
    pub user_nrp: String,

    pub rank_code: Option<String>,
    pub rank_name: Option<String>,

    pub base_tukin: i64,
    pub expected_units: f64,
    pub earned_credit: f64,
    pub attendance_ratio: f64,
    pub final_tukin: i64,

    pub breakdown: JsonValue,

    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct TukinCalculationsResp {
    pub status: &'static str,
    pub data: Vec<TukinCalculationRowDto>,
}

#[derive(Debug, Serialize)]
pub struct TukinPolicyListResp {
    pub status: &'static str,
    pub data: Vec<TukinPolicyDto>,
}

#[derive(Debug, Serialize)]
pub struct TukinLeaveRulesResp {
    pub status: &'static str,
    pub data: Vec<TukinLeaveRuleDto>,
}

#[derive(Debug, Deserialize)]
pub struct TukinPoliciesQuery {
    pub satker_id: Option<Uuid>,
}
