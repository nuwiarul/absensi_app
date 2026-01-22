// src/handler/tukin.rs

use axum::{Extension, Json, Router};
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{get, post, put};
use chrono::{Datelike, DateTime, Duration, NaiveDate, TimeZone, Utc};
use serde_json::json;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;
use crate::auth::rbac::UserRole;
use crate::constants::{AttendanceEventType, CalendarDayType, LeaveType};
use crate::database::attendance::AttendanceEventRepo;
use crate::database::duty_schedule::DutyScheduleRepo;
use crate::database::tukin::{LeaveSpanRow, TukinCalculationUpsert, TukinRepo};
use crate::database::user::UserRepo;
use crate::database::work_calendar::WorkCalendarRepo;
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::utils::timezone_cache::get_timezone_cached;

use crate::dtos::tukin::{
    CreateTukinPolicyReq, ReplaceLeaveRulesReq, TukinCalculationsQuery, TukinCalculationsResp,
    TukinGenerateQuery, TukinLeaveRulesResp, TukinPolicyListResp, TukinPreviewQuery,
    TukinPreviewResp, TukinUserSummaryDto, UpdateTukinPolicyReq,
};

pub fn tukin_handler() -> Router {
    Router::new()
        .route("/preview", get(preview_tukin))
        .route("/calculations", get(list_calculations))
        .route("/generate", post(generate_calculations))
        .route("/policies", get(list_policies).post(create_policy))
        .route("/policies/{id}", put(update_policy).delete(delete_policy))
        .route("/policies/{id}/leave-rules", get(get_leave_rules).put(put_leave_rules))
}

fn parse_month(month: &str) -> Result<(NaiveDate, NaiveDate), HttpError> {
    // month: YYYY-MM
    let parts: Vec<&str> = month.split('-').collect();
    if parts.len() != 2 {
        return Err(HttpError::bad_request("Format month harus YYYY-MM".to_string()));
    }
    let year: i32 = parts[0]
        .parse()
        .map_err(|_| HttpError::bad_request("Tahun tidak valid".to_string()))?;
    let m: u32 = parts[1]
        .parse()
        .map_err(|_| HttpError::bad_request("Bulan tidak valid".to_string()))?;
    if m < 1 || m > 12 {
        return Err(HttpError::bad_request("Bulan harus 01..12".to_string()));
    }

    let start = NaiveDate::from_ymd_opt(year, m, 1)
        .ok_or(HttpError::bad_request("Tanggal start tidak valid".to_string()))?;
    let (ny, nm) = if m == 12 { (year + 1, 1) } else { (year, m + 1) };
    let end_exclusive = NaiveDate::from_ymd_opt(ny, nm, 1)
        .ok_or(HttpError::bad_request("Tanggal end tidak valid".to_string()))?;
    Ok((start, end_exclusive))
}

fn date_range_inclusive(start: NaiveDate, end_exclusive: NaiveDate) -> Vec<NaiveDate> {
    let mut out = Vec::new();
    let mut d = start;
    while d < end_exclusive {
        out.push(d);
        d = d.succ_opt().unwrap();
    }
    out
}

fn leave_credit_for_date(
    leaves: &[LeaveSpanRow],
    rules: &HashMap<LeaveType, f64>,
    d: NaiveDate,
) -> Option<(LeaveType, f64)> {
    for lr in leaves {
        if d >= lr.start_date && d <= lr.end_date {
            let credit = rules.get(&lr.tipe).copied().unwrap_or(0.0);
            return Some((lr.tipe, credit));
        }
    }
    None
}

fn apply_satker_scope(
    mut satker_id: Option<Uuid>,
    query_user_id: Option<Uuid>,
    claims: &AuthMiddleware,
) -> Result<(Option<Uuid>, Option<Uuid>), HttpError> {
    // returns (satker_id_scoped, user_id_scoped)
    match claims.user_claims.role {
        UserRole::Superadmin => {
            // allowed
        }
        UserRole::SatkerAdmin | UserRole::SatkerHead => {
            satker_id = Some(claims.user_claims.satker_id);
        }
        UserRole::Member => {
            satker_id = Some(claims.user_claims.satker_id);
            if let Some(uid) = query_user_id {
                if uid != claims.user_claims.user_id {
                    return Err(HttpError::unauthorized(
                        "Tidak boleh melihat data user lain".to_string(),
                    ));
                }
            }
        }
    }
    Ok((satker_id, query_user_id))
}

async fn compute_tukin_summaries(
    month: String,
    satker_id: Option<Uuid>,
    user_id: Option<Uuid>,
    app_state: &Arc<AppState>,
    claims: &AuthMiddleware,
) -> Result<Vec<TukinUserSummaryDto>, HttpError> {
    let (period_start, period_end_exclusive) = parse_month(&month)?;
    let (satker_id, user_id) = apply_satker_scope(satker_id, user_id, claims)?;

    // Determine users
    let users = if let Some(uid) = user_id {
        let u = app_state
            .db_client
            .find_user_by_id(uid)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
            .ok_or(HttpError::bad_request("User tidak ditemukan".to_string()))?;

        if let Some(sid) = satker_id {
            if u.satker_id != sid {
                return Err(HttpError::unauthorized("User tidak sesuai satker".to_string()));
            }
        }

        vec![u]
    } else {
        let sid = satker_id.ok_or(HttpError::bad_request(
            "satker_id wajib untuk melihat banyak user".to_string(),
        ))?;
        app_state
            .db_client
            .get_user_by_satker_id(sid)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    };

    if users.is_empty() {
        return Ok(vec![]);
    }

    let sid_for_policy = satker_id.unwrap_or(users[0].satker_id);

    let policy = app_state
        .db_client
        .find_active_tukin_policy(sid_for_policy, period_start)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let leave_rules_vec = app_state
        .db_client
        .list_leave_rules(policy.id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let mut leave_rules: HashMap<LeaveType, f64> = HashMap::new();
    for r in leave_rules_vec {
        leave_rules.insert(r.leave_type, r.credit);
    }

    // Calendar days for satker
    let calendar_from = period_start;
    let calendar_to_inclusive = period_end_exclusive.pred_opt().unwrap();
    let calendar_days = app_state
        .db_client
        .list_calendar_days(sid_for_policy, calendar_from, calendar_to_inclusive)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let mut cal_map: HashMap<
        NaiveDate,
        (CalendarDayType, Option<chrono::NaiveTime>, Option<chrono::NaiveTime>),
    > = HashMap::new();
    for d in calendar_days {
        cal_map.insert(d.work_date, (d.day_type, d.expected_start, d.expected_end));
    }

    let dates = date_range_inclusive(period_start, period_end_exclusive);

    // IMPORTANT: timezone harus sama dengan rekap absensi (app_settings)
    let tz = get_timezone_cached(app_state).await?;

    // grace window untuk event duty schedule
    let grace_in = Duration::minutes(30);
    let grace_out = Duration::minutes(180);

    let mut result: Vec<TukinUserSummaryDto> = Vec::new();

    for u in users {
        let leaves = app_state
            .db_client
            .list_approved_leaves_by_user(
                u.id,
                period_start,
                period_end_exclusive.pred_opt().unwrap(),
            )
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        // NOTE: sessions ini sudah “rekap harian” (work_date), biasanya berasal dari logic rekap absensi
        let sessions = app_state
            .db_client
            .list_attendance_by_user_from_to(
                u.id,
                period_start,
                period_end_exclusive.pred_opt().unwrap(),
            )
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let mut sess_map: HashMap<NaiveDate, crate::dtos::attendance::AttendanceRekapDto> =
            HashMap::new();
        for s in sessions {
            sess_map.insert(s.work_date, s);
        }

        // duty schedule range: [start_local, end_exclusive_local) converted to UTC
        let from_dt: DateTime<Utc> = tz
            .from_local_datetime(&period_start.and_hms_opt(0, 0, 0).unwrap())
            .single()
            .unwrap()
            .with_timezone(&Utc);
        let to_dt: DateTime<Utc> = tz
            .from_local_datetime(&period_end_exclusive.and_hms_opt(0, 0, 0).unwrap())
            .single()
            .unwrap()
            .with_timezone(&Utc);

        let duty_schedules = app_state
            .db_client
            .list_duty_schedules(Some(u.satker_id), Some(u.id), from_dt, to_dt)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let mut duty_by_date: HashMap<NaiveDate, crate::dtos::duty_schedule::DutyScheduleDto> =
            HashMap::new();
        for ds in duty_schedules {
            // mapping default: pakai tanggal start_at (local date) kalau start_at sudah UTC
            // (kalau start_at tersimpan UTC, ini date_naive() akan UTC-date; untuk akurat,
            //  sebaiknya ds.start_at di-convert dulu ke tz. Tapi kita pertahankan sesuai yang kamu pakai).
            duty_by_date.insert(ds.start_at.with_timezone(&tz).date_naive(), ds);
        }

        let base_tukin = app_state
            .db_client
            .get_user_base_tukin(u.id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let mut expected_units = 0.0f64;
        let mut earned_credit = 0.0f64;

        let mut present_days = 0i32;
        let mut absent_days = 0i32;
        let mut missing_checkout_days = 0i32;
        let mut duty_present = 0i32;
        let mut duty_absent = 0i32;
        let mut total_late_minutes: i64 = 0;

        let mut days: Vec<crate::dtos::tukin::TukinDayBreakdownDto> = Vec::new();

        

        for d in &dates {
            let (day_type, expected_start, _expected_end) = cal_map
                .get(d)
                .copied()
                .unwrap_or((CalendarDayType::Workday, None, None));

            // sessions rekap (work_date)
            let sess = sess_map.get(d);

            // event leave type (fallback), dari rekap attendance
            let event_leave_raw = sess
                .and_then(|s| s.check_in_attendance_leave_type)
                .or_else(|| sess.and_then(|s| s.check_out_attendance_leave_type));

            // =========================================================
            // 1) APPROVED LEAVE REQUEST (MENANG MUTLAK)
            // =========================================================
            let leave_from_requests = leave_credit_for_date(&leaves, &leave_rules, *d);
            if let Some((lr_type, lr_credit)) = leave_from_requests {
                expected_units += 1.0;

                // optional: kalau user tetap absen, boleh "max" dengan credit hadir
                let mut credit_present = 0.0;
                let mut check_in_at = None;
                let mut check_out_at = None;

                if let Some(sess) = sess {
                    check_in_at = sess.check_in_at;
                    check_out_at = sess.check_out_at;

                    if sess.check_in_at.is_some() {
                        if sess.check_out_at.is_some() {
                            credit_present = 1.0;
                        } else {
                            credit_present =
                                (1.0 - (policy.missing_checkout_penalty_pct / 100.0)).max(0.0);
                            missing_checkout_days += 1;
                        }
                    }
                }

                let credit = credit_present.max(lr_credit);
                earned_credit += credit;

                if credit > 0.0 {
                    present_days += 1;
                } else {
                    absent_days += 1;
                }

                days.push(crate::dtos::tukin::TukinDayBreakdownDto {
                    work_date: *d,
                    expected_unit: 1.0,
                    earned_credit: credit,
                    is_duty_schedule: false,
                    duty_schedule_id: None,
                    check_in_at,
                    check_out_at,
                    late_minutes: None, // ✅ no late untuk approved leave
                    leave_type: Some(lr_type),
                    leave_credit: Some(lr_credit),
                    note: Some(format!("{:?}", lr_type).to_uppercase()),
                });

                continue;
            }

            // =========================================================
            // 2) DUTY SCHEDULE (WAJIB CHECK-IN, HOLIDAY TETAP WAJIB)
            // =========================================================
            if let Some(ds) = duty_by_date.get(d) {
                expected_units += 1.0;

                let window_start = ds.start_at - Duration::minutes(30);
                let window_end = ds.end_at + Duration::minutes(180);

                // ✅ Untuk duty schedule: check-out tidak wajib.
                // Tapi kalau user memang check-out, tetap tampilkan.
                // Dan untuk present/earned, kita utamakan data session (work_date) agar tidak miss karena window/shift.
                let mut check_in_at = sess.and_then(|s| s.check_in_at);
                let mut check_out_at = sess.and_then(|s| s.check_out_at);

                // Fallback: kalau session belum ada / tidak ketemu, cari event check-in dalam window duty.
                if check_in_at.is_none() {
                    let ci = app_state
                        .db_client
                        .find_first_event_in_range(
                            u.id,
                            AttendanceEventType::CheckIn,
                            window_start,
                            window_end,
                        )
                        .await
                        .map_err(|e| HttpError::server_error(e.to_string()))?;

                    if let Some(ci) = ci {
                        check_in_at = Some(ci.occurred_at);
                    }
                }

                // Optional display: kalau checkout belum ada di session, coba cari event checkout dalam window.
                if check_out_at.is_none() {
                    let co = app_state
                        .db_client
                        .find_first_event_in_range(
                            u.id,
                            AttendanceEventType::CheckOut,
                            window_start,
                            window_end,
                        )
                        .await
                        .map_err(|e| HttpError::server_error(e.to_string()))?;

                    if let Some(co) = co {
                        check_out_at = Some(co.occurred_at);
                    }
                }

                let credit = if check_in_at.is_some() { 1.0 } else { 0.0 };

                if credit > 0.0 {
                    duty_present += 1;
                    present_days += 1;
                } else {
                    duty_absent += 1;
                    absent_days += 1;
                }

                earned_credit += credit;

                days.push(crate::dtos::tukin::TukinDayBreakdownDto {
                    work_date: *d,
                    expected_unit: 1.0,
                    earned_credit: credit,
                    is_duty_schedule: true,
                    duty_schedule_id: Some(ds.id),
                    check_in_at,
                    check_out_at,
                    late_minutes: None, // ✅ no late
                    leave_type: None,
                    leave_credit: None,
                    note: Some("DUTY_SCHEDULE".to_string()),
                });

                continue;
            }

            // =========================================================
            // Kalau bukan leave_request & bukan duty_schedule:
            // Kalau HOLIDAY -> ignore (expected_unit 0)
            // =========================================================
            if day_type == CalendarDayType::Holiday {
                days.push(crate::dtos::tukin::TukinDayBreakdownDto {
                    work_date: *d,
                    expected_unit: 0.0,
                    earned_credit: 0.0,
                    is_duty_schedule: false,
                    duty_schedule_id: None,
                    check_in_at: None,
                    check_out_at: None,
                    late_minutes: None,
                    leave_type: None,
                    leave_credit: None,
                    note: Some("HOLIDAY_IGNORED".to_string()),
                });
                continue;
            }

            // =========================================================
            // 3) EVENT attendance_leave_type (fallback)
            // =========================================================
            if let Some(ev) = event_leave_raw {
                match ev {
                    // 3a) JADWAL_DINAS -> treated like duty schedule
                    crate::constants::AttendanceLeaveType::JadwalDinas => {
                        expected_units += 1.0;

                        let check_in_at = sess.and_then(|s| s.check_in_at);

                        let credit = if check_in_at.is_some() { 1.0 } else { 0.0 };

                        earned_credit += credit;

                        if credit > 0.0 {
                            present_days += 1;
                        } else {
                            absent_days += 1;
                        }

                        days.push(crate::dtos::tukin::TukinDayBreakdownDto {
                            work_date: *d,
                            expected_unit: 1.0,
                            earned_credit: credit,
                            is_duty_schedule: false,
                            duty_schedule_id: None,
                            check_in_at,
                            check_out_at: None,
                            late_minutes: None, // ✅ no late untuk jadwal_dinas
                            leave_type: None,
                            leave_credit: None,
                            note: Some("JADWAL_DINAS".to_string()),
                        });

                        continue;
                    }

                    // 3b) WFH/WFA -> treated as normal hadir (late + missing checkout berlaku)
                    crate::constants::AttendanceLeaveType::Wfh
                    | crate::constants::AttendanceLeaveType::Wfa => {
                        // lanjut ke NORMAL logic di bawah,
                        // tapi note akan jadi WFH/WFA.
                    }

                    // 3c) DINAS_LUAR / IJIN / SAKIT -> tanpa leave_request approved -> earn 0, no late
                    crate::constants::AttendanceLeaveType::DinasLuar
                    | crate::constants::AttendanceLeaveType::Ijin
                    | crate::constants::AttendanceLeaveType::Sakit => {
                        expected_units += 1.0;

                        earned_credit += 0.0;
                        absent_days += 1;

                        let note = match ev {
                            crate::constants::AttendanceLeaveType::DinasLuar => "DINAS_LUAR",
                            crate::constants::AttendanceLeaveType::Ijin => "IJIN",
                            crate::constants::AttendanceLeaveType::Sakit => "SAKIT",
                            _ => "EVENT",
                        };

                        days.push(crate::dtos::tukin::TukinDayBreakdownDto {
                            work_date: *d,
                            expected_unit: 1.0,
                            earned_credit: 0.0,
                            is_duty_schedule: false,
                            duty_schedule_id: None,
                            check_in_at: sess.and_then(|s| s.check_in_at),
                            check_out_at: sess.and_then(|s| s.check_out_at),
                            late_minutes: None, // ✅ no late
                            leave_type: None,
                            leave_credit: None,
                            note: Some(note.to_string()),
                        });

                        continue;
                    }

                    crate::constants::AttendanceLeaveType::Normal => {
                        // jatuh ke NORMAL
                    }
                }
            }

            // =========================================================
            // 4) NORMAL (termasuk WFH/WFA, karena lanjut ke sini)
            // =========================================================
            expected_units += 1.0;

            let mut credit_present = 0.0;
            let mut check_in_at = None;
            let mut check_out_at = None;
            let mut late_minutes = None;

            if let Some(sess) = sess {
                check_in_at = sess.check_in_at;
                check_out_at = sess.check_out_at;

                if let Some(ci) = sess.check_in_at {
                    // hitung late berdasarkan calendar expected_start (timezone app_settings)
                    if let Some(es) = expected_start {
                        let naive = d.and_time(es);
                        let expected_local = tz
                            .from_local_datetime(&naive)
                            .single()
                            .unwrap_or_else(|| tz.from_utc_datetime(&naive));
                        let expected_dt = expected_local.with_timezone(&Utc);

                        let lm = (ci - expected_dt).num_minutes();
                        let lm = if lm > 0 { lm } else { 0 };
                        late_minutes = Some(lm);
                        total_late_minutes += lm;
                    }

                    // hadir butuh check-in; checkout optional (missing checkout kena penalty)
                    if sess.check_out_at.is_some() {
                        credit_present = 1.0;
                    } else {
                        credit_present =
                            (1.0 - (policy.missing_checkout_penalty_pct / 100.0)).max(0.0);
                        missing_checkout_days += 1;
                    }
                }
            }

            let credit = credit_present;
            earned_credit += credit;

            if credit > 0.0 {
                present_days += 1;
            } else {
                absent_days += 1;
            }

            // note: kalau WFH/WFA, tampilkan itu, selain itu pakai day_type
            let note = match event_leave_raw {
                Some(crate::constants::AttendanceLeaveType::Wfh) => "WFH".to_string(),
                Some(crate::constants::AttendanceLeaveType::Wfa) => "WFA".to_string(),
                _ => format!("{:?}", day_type).to_uppercase(),
            };

            days.push(crate::dtos::tukin::TukinDayBreakdownDto {
                work_date: *d,
                expected_unit: 1.0,
                earned_credit: credit,
                is_duty_schedule: false,
                duty_schedule_id: None,
                check_in_at,
                check_out_at,
                late_minutes,
                leave_type: None,
                leave_credit: None,
                note: Some(note),
            });
        }


        let ratio = if expected_units > 0.0 {
            earned_credit / expected_units
        } else {
            0.0
        };
        let final_tukin = ((base_tukin as f64) * ratio).round() as i64;

        result.push(TukinUserSummaryDto {
            user_id: u.id,
            satker_id: u.satker_id,
            nrp: u.nrp,
            full_name: u.full_name,
            month: month.clone(),
            policy_id: policy.id,
            base_tukin,
            expected_units,
            earned_credit,
            attendance_ratio: ratio,
            final_tukin,
            present_days,
            absent_days,
            missing_checkout_days,
            duty_present,
            duty_absent,
            total_late_minutes,
            days,
        });
    }

    Ok(result)
}

pub async fn preview_tukin(
    Query(query): Query<TukinPreviewQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let data = compute_tukin_summaries(
        query.month,
        query.satker_id,
        query.user_id,
        &app_state,
        &user_claims,
    )
        .await?;
    Ok(Json(TukinPreviewResp { status: "200", data }))
}

pub async fn list_calculations(
    Query(query): Query<TukinCalculationsQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let (month_start, _) = parse_month(&query.month)?;
    let (satker_id, user_id) = apply_satker_scope(query.satker_id, query.user_id, &user_claims)?;

    // member restrictions already applied. for bulk, satker required
    if user_id.is_none() && satker_id.is_none() {
        return Err(HttpError::bad_request(
            "satker_id wajib untuk melihat banyak user".to_string(),
        ));
    }

    let rows = app_state
        .db_client
        .list_tukin_calculations(month_start, satker_id, user_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(TukinCalculationsResp { status: "200", data: rows }))
}

pub async fn generate_calculations(
    Query(query): Query<TukinGenerateQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let (month_start, _) = parse_month(&query.month)?;

    // if not force and cache exists, return cache
    let (satker_id_scoped, user_id_scoped) =
        apply_satker_scope(query.satker_id, query.user_id, &user_claims)?;
    if user_id_scoped.is_none() && satker_id_scoped.is_none() {
        return Err(HttpError::bad_request(
            "satker_id wajib untuk generate banyak user".to_string(),
        ));
    }

    let force = query.force.unwrap_or(false);
    if !force {
        let cached = app_state
            .db_client
            .list_tukin_calculations(month_start, satker_id_scoped, user_id_scoped)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        if !cached.is_empty() {
            return Ok(Json(TukinCalculationsResp { status: "200", data: cached }));
        }
    }

    let summaries = compute_tukin_summaries(
        query.month.clone(),
        query.satker_id,
        query.user_id,
        &app_state,
        &user_claims,
    )
        .await?;

    // upsert semua (hasil upsert Dto mentah tidak dipakai)
    for s in summaries {
        let breakdown = json!({
            "month": s.month,
            "present_days": s.present_days,
            "absent_days": s.absent_days,
            "missing_checkout_days": s.missing_checkout_days,
            "duty_present": s.duty_present,
            "duty_absent": s.duty_absent,
            "total_late_minutes": s.total_late_minutes,
            "days": s.days,
        });

        app_state
            .db_client
            .upsert_tukin_calculation(TukinCalculationUpsert {
                month: month_start,
                satker_id: s.satker_id,
                user_id: s.user_id,
                policy_id: s.policy_id,
                base_tukin: s.base_tukin,
                expected_units: s.expected_units,
                earned_credit: s.earned_credit,
                attendance_ratio: s.attendance_ratio,
                final_tukin: s.final_tukin,
                breakdown,
            })
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
    }

    // ✅ ambil ulang dari cache pakai JOIN (RowDto) supaya nama/NRP/pangkat muncul
    let rows = app_state
        .db_client
        .list_tukin_calculations(month_start, satker_id_scoped, user_id_scoped)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;


    Ok(Json(TukinCalculationsResp { status: "200", data: rows }))
}

pub async fn list_policies(
    Query(query): Query<crate::dtos::tukin::TukinPoliciesQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    // reuse fields: satker_id optional
    let mut satker_id = query.satker_id;
    match user_claims.user_claims.role {
        UserRole::Superadmin => {}
        UserRole::SatkerAdmin | UserRole::SatkerHead => {
            satker_id = Some(user_claims.user_claims.satker_id);
        }
        UserRole::Member => {
            return Err(HttpError::unauthorized("Tidak boleh".to_string()));
        }
    }

    let rows = app_state
        .db_client
        .list_tukin_policies(satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(TukinPolicyListResp { status: "200", data: rows }))
}

pub async fn create_policy(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(mut req): Json<CreateTukinPolicyReq>,
) -> Result<impl IntoResponse, HttpError> {
    match user_claims.user_claims.role {
        UserRole::Superadmin => {
            // ok
        }
        UserRole::SatkerAdmin | UserRole::SatkerHead => {
            // force satker policy
            req.scope = "SATKER".to_string();
            req.satker_id = Some(user_claims.user_claims.satker_id);
        }
        UserRole::Member => return Err(HttpError::unauthorized("Tidak boleh".to_string())),
    }

    if req.scope.to_uppercase() == "GLOBAL" {
        if user_claims.user_claims.role != UserRole::Superadmin {
            return Err(HttpError::unauthorized(
                "Tidak boleh membuat policy GLOBAL".to_string(),
            ));
        }
        req.satker_id = None;
    }

    if req.scope.to_uppercase() == "SATKER" {
        if req.satker_id.is_none() {
            return Err(HttpError::bad_request(
                "satker_id wajib untuk scope SATKER".to_string(),
            ));
        }
    }

    let row = app_state
        .db_client
        .create_tukin_policy(req)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(row))
}

pub async fn update_policy(
    Path(id): Path<Uuid>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(req): Json<UpdateTukinPolicyReq>,
) -> Result<impl IntoResponse, HttpError> {
    // Find policy in scope
    let sid = match user_claims.user_claims.role {
        UserRole::Superadmin => None,
        UserRole::SatkerAdmin | UserRole::SatkerHead => Some(user_claims.user_claims.satker_id),
        UserRole::Member => return Err(HttpError::unauthorized("Tidak boleh".to_string())),
    };

    let policies = app_state
        .db_client
        .list_tukin_policies(sid)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let p = policies
        .into_iter()
        .find(|p| p.id == id)
        .ok_or(HttpError::bad_request("Policy tidak ditemukan".to_string()))?;

    if user_claims.user_claims.role != UserRole::Superadmin {
        if p.scope == "GLOBAL" {
            return Err(HttpError::unauthorized(
                "Tidak boleh mengubah policy GLOBAL".to_string(),
            ));
        }
        if p.satker_id != Some(user_claims.user_claims.satker_id) {
            return Err(HttpError::unauthorized("Tidak boleh".to_string()));
        }
    }

    let updated = app_state
        .db_client
        .update_tukin_policy(id, req)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(updated))
}

pub async fn get_leave_rules(
    Path(id): Path<Uuid>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    match user_claims.user_claims.role {
        UserRole::Superadmin | UserRole::SatkerAdmin | UserRole::SatkerHead => {}
        _ => return Err(HttpError::unauthorized("Tidak boleh".to_string())),
    }

    // scope check: if satker role, ensure policy visible
    if user_claims.user_claims.role != UserRole::Superadmin {
        let policies = app_state
            .db_client
            .list_tukin_policies(Some(user_claims.user_claims.satker_id))
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;
        let p = policies
            .into_iter()
            .find(|p| p.id == id)
            .ok_or(HttpError::bad_request("Policy tidak ditemukan".to_string()))?;
        if p.scope == "SATKER" && p.satker_id != Some(user_claims.user_claims.satker_id) {
            return Err(HttpError::unauthorized("Tidak boleh".to_string()));
        }
    }

    let rows = app_state
        .db_client
        .list_leave_rules(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(TukinLeaveRulesResp { status: "200", data: rows }))
}

pub async fn put_leave_rules(
    Path(id): Path<Uuid>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(req): Json<ReplaceLeaveRulesReq>,
) -> Result<impl IntoResponse, HttpError> {
    match user_claims.user_claims.role {
        UserRole::Superadmin => {}
        UserRole::SatkerAdmin | UserRole::SatkerHead => {
            // cannot edit global
            let policies = app_state
                .db_client
                .list_tukin_policies(Some(user_claims.user_claims.satker_id))
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?;
            let p = policies
                .into_iter()
                .find(|p| p.id == id)
                .ok_or(HttpError::bad_request("Policy tidak ditemukan".to_string()))?;
            if p.scope == "GLOBAL" {
                return Err(HttpError::unauthorized(
                    "Tidak boleh mengubah policy GLOBAL".to_string(),
                ));
            }
            if p.satker_id != Some(user_claims.user_claims.satker_id) {
                return Err(HttpError::unauthorized("Tidak boleh".to_string()));
            }
        }
        _ => return Err(HttpError::unauthorized("Tidak boleh".to_string())),
    }

    let rows = app_state
        .db_client
        .replace_leave_rules(id, req.rules)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(TukinLeaveRulesResp { status: "200", data: rows }))
}

pub async fn delete_policy(
    Path(id): Path<Uuid>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    // scope visibility
    let sid = match user_claims.user_claims.role {
        UserRole::Superadmin => None,
        UserRole::SatkerAdmin | UserRole::SatkerHead => Some(user_claims.user_claims.satker_id),
        UserRole::Member => return Err(HttpError::unauthorized("Tidak boleh".to_string())),
    };

    let policies = app_state
        .db_client
        .list_tukin_policies(sid)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let p = policies
        .iter()
        .find(|p| p.id == id)
        .cloned()
        .ok_or(HttpError::bad_request("Policy tidak ditemukan".to_string()))?;

    // permission: satker roles cannot delete GLOBAL
    if user_claims.user_claims.role != UserRole::Superadmin {
        if p.scope == "GLOBAL" {
            return Err(HttpError::unauthorized("Tidak boleh menghapus policy GLOBAL".to_string()));
        }
        if p.satker_id != Some(user_claims.user_claims.satker_id) {
            return Err(HttpError::unauthorized("Tidak boleh".to_string()));
        }
    }

    // business rule:
    // - GLOBAL: hanya boleh hapus policy lama (bukan yang terbaru) dan harus ada >= 2 global policy
    if p.scope == "GLOBAL" {
        let mut globals: Vec<_> = policies.into_iter().filter(|x| x.scope == "GLOBAL").collect();
        //globals.sort_by(|a, b| b.effective_from.cmp(&a.effective_from)); // desc
        globals.sort_by(|a, b| b.created_at.cmp(&a.created_at)); // DESC by created_at

        if globals.len() < 2 {
            return Err(HttpError::bad_request("Global policy minimal harus 1. Tidak bisa dihapus.".to_string()));
        }

        let newest_id = globals[0].id;
        if id == newest_id {
            return Err(HttpError::bad_request("Tidak boleh menghapus policy GLOBAL yang terbaru.".to_string()));
        }
    }

    // try delete
    let res = app_state.db_client.delete_tukin_policy(id).await;
    match res {
        Ok(_) => Ok(Json(json!({ "status": "200" }))),
        Err(e) => {
            // FK RESTRICT bisa terjadi kalau policy sudah dipakai di tukin_calculations (policy_id ON DELETE RESTRICT)
            // kita kasih message lebih ramah
            if let sqlx::Error::Database(db_err) = &e {
                if db_err.code().as_deref() == Some("23503") {
                    return Err(HttpError::bad_request("Policy tidak bisa dihapus karena sudah dipakai pada perhitungan tukin.".to_string()));
                }
            }
            Err(HttpError::server_error(e.to_string()))
        }
    }
}



