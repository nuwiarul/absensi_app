use crate::AppState;
use crate::constants::{AttendanceEventType, AttendanceLeaveType};
use crate::database::attendance::{AddAttendanceEvent, AttendanceEventRepo};
use crate::database::attendance_session::AttendanceSessionRepo;
use crate::database::geofence::GeofenceRepo;
use crate::dtos::attendance::{AttendanceDto, AttendanceRekapDto, AttendanceRekapDtoQuery, AttendanceRekapDtoResp, AttendanceRekapsDtoResp, AttendanceReq, AttendanceResp, AttendanceSessionTodayDto, AttendanceSessionTodayResp};
use crate::dtos::geofence::CreateGeofenceReq;
use crate::error::HttpError;
use crate::handler::attendance_challenge::{anti_teleport_check, validate_and_use_challenge};
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::utils::fungsi::haversine_m;
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Extension, Json, Router};
use chrono::{Duration, NaiveDate, NaiveTime, TimeZone, Utc};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;
use crate::database::user_device::UserDeviceRepo;
use chrono_tz::Asia::Jakarta;
use crate::auth::rbac::UserRole;
use crate::database::attendance_apel::AttendanceApelRepo;
use crate::database::duty_schedule::DutyScheduleRepo;
use crate::database::leave_request::LeaveRequestRepo;
use crate::database::schedule::ScheduleRepo;
use crate::database::work_pattern::{pick_effective_pattern, WorkPatternRepo};
use crate::dtos::duty_schedule::DutyScheduleDto;
use crate::dtos::schedule::{can_manage_schedule, ScheduleQuery, SchedulesResp};
use crate::handler::attendance_admin::attendance_admin_handler;
use crate::utils::timezone_cache::get_timezone_cached;

pub fn attendance_handler() -> Router {
    Router::new()
        .route("/check-in", post(check_in))
        .route("/check-out", post(check_out))
        .route("/session-today", get(get_attendance_session_today))
        .route("/get", get(find_attendance))
        .route("/list", get(list_attendances))
        .nest("/admin", attendance_admin_handler())
}


const EARLY_CHECKIN_HOURS: i64 = 2;
const DUTY_GRACE_HOURS: i64 = 6;
const DUTY_MAX_CHECKOUT_HOURS: i64 = 24;

const DUTY_CARD_GRACE_MINUTES: i64 = 30;

fn local_day_bounds_utc<Tz: TimeZone>(tz: &Tz, date: NaiveDate) -> (chrono::DateTime<Utc>, chrono::DateTime<Utc>)
where
    Tz::Offset: std::fmt::Display,
{
    // Convert local midnight bounds to UTC.
    let start_local = date.and_time(NaiveTime::from_hms_opt(0, 0, 0).unwrap());
    let next_local = (date + chrono::Days::new(1)).and_time(NaiveTime::from_hms_opt(0, 0, 0).unwrap());

    let start_utc = tz
        .from_local_datetime(&start_local)
        .single()
        .unwrap_or_else(|| tz.from_local_datetime(&start_local).earliest().unwrap())
        .with_timezone(&Utc);
    let end_utc = tz
        .from_local_datetime(&next_local)
        .single()
        .unwrap_or_else(|| tz.from_local_datetime(&next_local).earliest().unwrap())
        .with_timezone(&Utc);
    (start_utc, end_utc)
}

async fn find_active_duty_now(
    app_state: &Arc<AppState>,
    satker_id: Uuid,
    user_id: Uuid,
    now: chrono::DateTime<Utc>,
) -> Result<Option<DutyScheduleDto>, HttpError> {
    // Query a small window and filter by intersection with 'now'.
    let from = now - Duration::days(2);
    let to = now + Duration::days(2);
    let items = app_state
        .db_client
        .list_duty_schedules(Some(satker_id), Some(user_id), from, to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(items
        .into_iter()
        .find(|d| d.start_at <= now && d.end_at > now))
}

/// Untuk attendance card (UX): anggap duty masih relevan sampai `DUTY_CARD_GRACE_MINUTES`
/// setelah end_at, supaya tombol check-out tidak hilang tepat saat shift selesai.
async fn find_duty_now_for_card(
    app_state: &Arc<AppState>,
    satker_id: Uuid,
    user_id: Uuid,
    now: chrono::DateTime<Utc>,
) -> Result<Option<DutyScheduleDto>, HttpError> {
    let from = now - Duration::days(2);
    let to = now + Duration::days(2);
    let items = app_state
        .db_client
        .list_duty_schedules(Some(satker_id), Some(user_id), from, to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let grace = Duration::minutes(DUTY_CARD_GRACE_MINUTES);
    Ok(items
        .into_iter()
        .find(|d| d.start_at <= now && (d.end_at + grace) > now))
}
async fn find_duty_by_local_date(
    app_state: &Arc<AppState>,
    satker_id: Uuid,
    user_id: Uuid,
    tz: &chrono_tz::Tz,
    date: NaiveDate,
) -> Result<Option<DutyScheduleDto>, HttpError> {
    let (from, to) = local_day_bounds_utc(tz, date);
    let items = app_state
        .db_client
        .list_duty_schedules(Some(satker_id), Some(user_id), from, to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    // There should be max 1 due to overlap constraint. If multiple, pick earliest start.
    Ok(items.into_iter().min_by_key(|d| d.start_at))
}

async fn get_work_window_local(
    app_state: &Arc<AppState>,
    satker_id: Uuid,
    work_date: NaiveDate,
) -> Result<(NaiveTime, NaiveTime), HttpError> {
    let patterns = app_state
        .db_client
        .list_work_patterns(satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;
    let p = pick_effective_pattern(&patterns, work_date).ok_or_else(|| {
        HttpError::bad_request("work pattern belum diset untuk satker ini".to_string())
    })?;
    Ok((p.work_start, p.work_end))
}

pub async fn check_in(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<AttendanceReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    /*
    validate_and_use_challenge(&app_state, &user_claims.user_claims, payload.challenge_id)
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

     */

    let device_id = payload.device_id.clone()
        .ok_or(HttpError::bad_request("device_id wajib".to_string()))?;

    app_state.db_client
        .ensure_device_bound_first_user(
            user_claims.user_claims.user_id,
            &device_id,
            payload.device_model.clone(),
            payload.android_version.clone(),
            payload.app_build.clone(),
            payload.client_version.clone(),
        ).await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    // ✅ reject mock
    if payload.is_mock.unwrap_or(false) {
        return Err(HttpError::bad_request("mock location terdeteksi".to_string()));
    }

    // ✅ reject location too old
    /*if let Some(age) = payload.location_age_ms {
        if age > 10_000 {
            return Err(HttpError::bad_request("lokasi terlalu lama, silakan refresh lokasi".to_string()));
        }
    }*/

    // ✅ reject accuracy too poor
    if let Some(acc) = payload.accuracy_meters {
        if acc > 50.0 {
            return Err(HttpError::bad_request("akurasi lokasi terlalu rendah, silakan coba lagi".to_string()));
        }
    }

    validate_and_use_challenge(
        &app_state,
        &user_claims.user_claims,
        payload.challenge_id,
        &device_id, // ✅ bind device
    ).await?;

    anti_teleport_check(
        &app_state,
        user_claims.user_claims.user_id,
        &device_id,
        payload.latitude,
        payload.longitude,
    ).await?;

    let nearest = nearest_geofence(
        &app_state,
        user_claims.user_claims.satker_id,
        payload.latitude,
        payload.longitude,
    )
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let (geofence_id, distance_m, radius_m) = nearest.ok_or(HttpError::bad_request(
        "geofence aktif belum diset untuk satker ini".to_string(),
    ))?;

    /*if distance_m > radius_m as f64 {
        return Err(HttpError::bad_request(format!(
            "di luar geofence: jarak {:.1}m > radius {}m",
            distance_m, radius_m
        )));
    }*/

    let out_of_fence = distance_m > radius_m as f64;

    let mut leave_type = payload.leave_type.clone().unwrap_or(AttendanceLeaveType::Normal);
    let leave_notes = payload.leave_notes.clone();

    if out_of_fence {
        if matches!(leave_type, AttendanceLeaveType::Normal) {
            return Err(HttpError::bad_request(format!(
                "di luar geofence: jarak {:.1}m > radius {}m. Pilih jenis izin/dinas terlebih dahulu",
                distance_m, radius_m
            )));
        }
    } else {
        leave_type = AttendanceLeaveType::Normal;
    }

    let now = Utc::now();

    let tz = get_timezone_cached(&app_state).await?;
    let local_now = now.with_timezone(&tz);
    let today = local_now.date_naive();
    let yesterday = today - chrono::Days::new(1);

    // 1) Leave request (approved) does not block check-in.
    let _has_leave_today = app_state
        .db_client
        .has_approved_leave_on_date(user_claims.user_claims.user_id, today)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // 2) If there is an active duty schedule right now, we check-in against its work_date
    // (local date of duty.start_at).
    let duty_active = find_active_duty_now(
        &app_state,
        user_claims.user_claims.satker_id,
        user_claims.user_claims.user_id,
        now,
    )
        .await?;

    // 3) If there is a duty schedule yesterday and its session is still open, block check-in
    // until duty_end_at + grace. After that, allow check-in (avoid dead-end).
    if duty_active.is_none() {
        if let Some(duty_yesterday) = find_duty_by_local_date(
            &app_state,
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            &tz,
            yesterday,
        )
            .await? {
            let duty_work_date = duty_yesterday.start_at.with_timezone(&tz).date_naive();
            if let Some(sess_y) = app_state
                .db_client
                .find_attendance_session_by_user_date(user_claims.user_claims.user_id, duty_work_date)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))? {
                if sess_y.check_in_at.is_some() && sess_y.check_out_at.is_none() {
                    let grace_until = duty_yesterday.end_at + Duration::hours(DUTY_GRACE_HOURS);
                    if now <= grace_until {

                        return Err(HttpError::bad_request(format!(
                            "anda belum check-out dari jadwal dinas yang kemarin ({} - {})",
                            //duty_yesterday.start_at.to_rfc3339(),
                            duty_yesterday.start_at.format("%d %b %Y %H:%M"),
                            //duty_yesterday.end_at.to_rfc3339()
                            duty_yesterday.end_at.format("%d %b %Y %H:%M"),
                        )));
                    }
                }
            }
        }
    }

    // 4) Duty schedule hari ini yang "upcoming" juga harus diperlakukan sebagai konteks duty,
    // supaya user bisa check-in dalam window EARLY_CHECKIN_HOURS sebelum start_at.
    // Contoh: duty 20:00, user check-in 19:00 -> harus boleh (bukan kena jam kerja normal).
    let duty_today = if duty_active.is_none() {
        find_duty_by_local_date(
            &app_state,
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            &tz,
            today,
        )
            .await?
    } else {
        None
    };

    // Pick duty context: active now > upcoming today (within early window) > none.
    let duty_ctx: Option<DutyScheduleDto> = match duty_active {
        Some(d) => Some(d),
        None => {
            if let Some(d) = duty_today {
                let earliest = d.start_at - Duration::hours(EARLY_CHECKIN_HOURS);
                // allow check-in from (start_at - early) up to (end_at + grace)
                let latest = d.end_at + Duration::hours(DUTY_GRACE_HOURS);
                if now >= earliest && now <= latest {
                    Some(d)
                } else {
                    None
                }
            } else {
                None
            }
        }
    };

    // Determine target work_date/session based on duty-active or today.
    let (target_work_date, _duty_context): (NaiveDate, Option<DutyScheduleDto>) =
        if let Some(duty) = duty_ctx {
            (duty.start_at.with_timezone(&tz).date_naive(), Some(duty))
        } else {
            (today, None)
        };

    // Already checked in for the target work_date?
    if let Some(existing) = app_state
        .db_client
        .find_attendance_session_by_user_date(user_claims.user_claims.user_id, target_work_date)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))? {
        if let Some(ci) = existing.check_in_at {
            let ci_local = ci.with_timezone(&tz);
            return Err(HttpError::bad_request(format!(
                "Anda sudah melakukan check in, pada hari ini {}",
                //ci.to_rfc3339()
                ci_local.format("%d %b %Y %H:%M")
            )));
        }
    }

    // If not in duty context, enforce work window.
    // Also keep work_start_dt for apel window validation.
    let mut work_start_dt_local: Option<chrono::DateTime<chrono_tz::Tz>> = None;
    if _duty_context.is_none() {
        let (work_start, work_end) = get_work_window_local(
            &app_state,
            user_claims.user_claims.satker_id,
            target_work_date,
        )
            .await?;

        let start_local = target_work_date.and_time(work_start);
        let end_local = target_work_date.and_time(work_end);

        let work_start_dt = tz
            .from_local_datetime(&start_local)
            .single()
            .unwrap_or_else(|| tz.from_local_datetime(&start_local).earliest().unwrap());
        let work_end_dt = tz
            .from_local_datetime(&end_local)
            .single()
            .unwrap_or_else(|| tz.from_local_datetime(&end_local).earliest().unwrap());

        let earliest = work_start_dt - Duration::hours(EARLY_CHECKIN_HOURS);
        work_start_dt_local = Some(work_start_dt);
        if local_now < earliest {
            return Err(HttpError::bad_request(format!(
                "anda check-in terlalu dini. paling cepat {}",
                //earliest.with_timezone(&Utc).to_rfc3339()
                earliest.format("%d %b %Y %H:%M")
            )));
        }
        if local_now > work_end_dt {
            return Err(HttpError::bad_request(format!(
                "anda check-in sudah melewati jam kerja. batas akhir {}",
                //work_end_dt.with_timezone(&Utc).to_rfc3339()
                work_end_dt.format("%d %b %Y %H:%M")
            )));
        }
    }

    let session_id = app_state
        .db_client
        .upsert_attendance_session(
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            target_work_date,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Keep legacy event-based dedup check (in case session existed without check_in_at).
    if app_state
        .db_client
        .find_attendance_event_by_session(session_id, AttendanceEventType::CheckIn)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
        .is_some()
    {
        let sess_check_in = app_state
            .db_client
            .find_attendance_session(session_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        if let Some(ci) = sess_check_in.check_in_at {
            let ci_local = ci.with_timezone(&tz);
            return Err(HttpError::bad_request(format!(
                "Anda sudah melakukan check in, pada hari ini {}",
                //ci.to_rfc3339()
                ci_local.format("%d %b %Y %H:%M")
            )));
        }
        return Err(HttpError::bad_request("Anda sudah melakukan check in".to_string()));
    }

    let updated = app_state
        .db_client
        .update_check_in_attendance_session(session_id, Some(now))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let fence_row = app_state
        .db_client
        .find_geofence(geofence_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let add_row = AddAttendanceEvent {
        session_id,
        satker_id: user_claims.user_claims.satker_id,
        user_id: user_claims.user_claims.user_id,
        event_type: AttendanceEventType::CheckIn,
        now,
        latitude: Some(payload.latitude),
        longitude: Some(payload.longitude),
        accuracy_meters: payload.accuracy_meters,
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        selfie_object_key: payload.selfie_object_key,
        liveness_score: payload.liveness_score,
        face_match_score: payload.face_match_score,
        device_id: payload.device_id,
        client_version: payload.client_version,
        server_challenge_id: Some(payload.challenge_id),
        device_model: payload.device_model,
        android_version: payload.android_version,
        app_build: payload.app_build,
        attendance_leave_type: leave_type,
        attendance_leave_notes: leave_notes,
    };

    app_state
        .db_client
        .add_attendance_event(add_row)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Optional: record apel (laporan) if requested and eligible.
    // Eligibility rules (backend authority):
    // - harus di dalam geofence (out_of_fence == false)
    // - tidak dalam konteks duty schedule
    // - masih dalam window apel: now <= work_start + 2 jam
    if payload.apel.unwrap_or(false) && !out_of_fence && _duty_context.is_none() {
        if let Some(ws) = work_start_dt_local {
            let apel_deadline = ws + Duration::hours(EARLY_CHECKIN_HOURS);
            if local_now <= apel_deadline {
                // work_date apel mengikuti tanggal lokal hari ini, bukan tanggal duty.
                let _ = app_state
                    .db_client
                    .upsert_attendance_apel(
                        user_claims.user_claims.satker_id,
                        user_claims.user_claims.user_id,
                        today,
                        now,
                        "PAGI",
                        "CHECKIN",
                    )
                    .await;
            }
        }
    }

    let attendance_dto = AttendanceDto {
        session_id: updated.id,
        work_date: updated.work_date,
        check_in_at: updated.check_in_at.map(|t| t.into()),
        check_out_at: updated.check_out_at.map(|t| t.into()),
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        geofence_name: Some(fence_row.unwrap().name),
    };

    let response = AttendanceResp {
        status: "200",
        data: attendance_dto,
    };

    Ok(Json(response))
}

pub async fn check_out(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<AttendanceReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;
    /*
    validate_and_use_challenge(&app_state, &user_claims.user_claims, payload.challenge_id)
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

     */

    let device_id = payload.device_id.clone()
        .ok_or(HttpError::bad_request("device_id wajib".to_string()))?;

    app_state.db_client
        .ensure_device_bound_first_user(
            user_claims.user_claims.user_id,
            &device_id,
            payload.device_model.clone(),
            payload.android_version.clone(),
            payload.app_build.clone(),
            payload.client_version.clone(),
        ).await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    // ✅ reject mock
    if payload.is_mock.unwrap_or(false) {
        return Err(HttpError::bad_request("mock location terdeteksi".to_string()));
    }

    // ✅ reject location too old
    /* if let Some(age) = payload.location_age_ms {
         if age > 10_000 {
             return Err(HttpError::bad_request("lokasi terlalu lama, silakan refresh lokasi".to_string()));
         }
     }*/

    // ✅ reject accuracy too poor
    if let Some(acc) = payload.accuracy_meters {
        if acc > 50.0 {
            return Err(HttpError::bad_request("akurasi lokasi terlalu rendah, silakan coba lagi".to_string()));
        }
    }

    validate_and_use_challenge(
        &app_state,
        &user_claims.user_claims,
        payload.challenge_id,
        &device_id, // ✅ bind device
    ).await?;

    anti_teleport_check(
        &app_state,
        user_claims.user_claims.user_id,
        &device_id,
        payload.latitude,
        payload.longitude,
    ).await?;

    let nearest = nearest_geofence(
        &app_state,
        user_claims.user_claims.satker_id,
        payload.latitude,
        payload.longitude,
    )
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let (geofence_id, distance_m, radius_m) = nearest.ok_or(HttpError::bad_request(
        "geofence aktif belum diset untuk satker ini".to_string(),
    ))?;

    /* if distance_m > radius_m as f64 {
         return Err(HttpError::bad_request(format!(
             "di luar geofence: jarak {:.1}m > radius {}m",
             distance_m, radius_m
         )));
     }*/

    let out_of_fence = distance_m > radius_m as f64;

    let mut leave_type = payload.leave_type.clone().unwrap_or(AttendanceLeaveType::Normal);
    let leave_notes = payload.leave_notes.clone();

    if out_of_fence {
        if matches!(leave_type, AttendanceLeaveType::Normal) {
            return Err(HttpError::bad_request(format!(
                "di luar geofence: jarak {:.1}m > radius {}m. Pilih jenis izin/dinas terlebih dahulu",
                distance_m, radius_m
            )));
        }
    } else {
        leave_type = AttendanceLeaveType::Normal;
    }

    let now = Utc::now();
    let tz = get_timezone_cached(&app_state).await?;
    let local_now = now.with_timezone(&tz);
    let today = local_now.date_naive();
    let yesterday = today - chrono::Days::new(1);

    // Rule: if user has approved leave today, they still must have a check-in before check-out.
    let _has_leave_today = app_state
        .db_client
        .has_approved_leave_on_date(user_claims.user_claims.user_id, today)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // 1) Prefer session today.
    let mut target_work_date = today;
    let mut used_duty = false;
    let mut target_session = app_state
        .db_client
        .find_attendance_session_by_user_date(user_claims.user_claims.user_id, today)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if target_session.as_ref().and_then(|s| s.check_in_at).is_none() {
        // 2) If no check-in today, try active duty now.
        if let Some(duty_active) = find_active_duty_now(
            &app_state,
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            now,
        )
            .await?
        {
            let duty_work_date = duty_active.start_at.with_timezone(&tz).date_naive();
            let sess = app_state
                .db_client
                .find_attendance_session_by_user_date(user_claims.user_claims.user_id, duty_work_date)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?;
            if let Some(s) = sess {
                if s.check_in_at.is_none() {
                    return Err(HttpError::bad_request("anda belum check-in".to_string()));
                }
                let max_until = duty_active.end_at + Duration::hours(DUTY_MAX_CHECKOUT_HOURS);
                if now > max_until {
                    return Err(HttpError::bad_request(format!(
                        "anda check-out lebih dari {} jam dari shift yang diijinkan",
                        DUTY_MAX_CHECKOUT_HOURS
                    )));
                }
                target_work_date = duty_work_date;
                used_duty = true;
                target_session = Some(s);
            } else {
                return Err(HttpError::bad_request("anda belum check-in".to_string()));
            }
        } else {
            // 3) Else try duty yesterday.
            if let Some(duty_yesterday) = find_duty_by_local_date(
                &app_state,
                user_claims.user_claims.satker_id,
                user_claims.user_claims.user_id,
                &tz,
                yesterday,
            )
                .await?
            {
                let duty_work_date = duty_yesterday.start_at.with_timezone(&tz).date_naive();
                let sess = app_state
                    .db_client
                    .find_attendance_session_by_user_date(user_claims.user_claims.user_id, duty_work_date)
                    .await
                    .map_err(|e| HttpError::server_error(e.to_string()))?;
                if let Some(s) = sess {
                    if s.check_in_at.is_none() {
                        return Err(HttpError::bad_request("anda belum check-in".to_string()));
                    }
                    let max_until = duty_yesterday.end_at + Duration::hours(DUTY_MAX_CHECKOUT_HOURS);
                    if now > max_until {
                        return Err(HttpError::bad_request(format!(
                            "anda check-out lebih dari {} jam dari shift yang diijinkan",
                            DUTY_MAX_CHECKOUT_HOURS
                        )));
                    }
                    target_work_date = duty_work_date;
                    used_duty = true;
                    target_session = Some(s);
                } else {
                    return Err(HttpError::bad_request("anda belum check-in".to_string()));
                }
            } else {
                return Err(HttpError::bad_request("anda belum check-in".to_string()));
            }
        }
    }

    let session_id = match target_session {
        Some(s) => s.id,
        None => {
            // If we got here, it means there was no session today and no duty fallback.
            return Err(HttpError::bad_request("anda belum check-in".to_string()));
        }
    };

    let attendance_event_row = app_state
        .db_client
        .find_attendance_event_by_session(session_id, AttendanceEventType::CheckOut)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if let Some(_) = attendance_event_row {

        let sess_check_in = app_state.db_client
            .find_attendance_session(session_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let session_hour = sess_check_in.check_out_at.unwrap();
        //let iso = session_hour.to_rfc3339();
        let iso = session_hour.format("%d %b %Y %H:%M").to_string();

        return Err(HttpError::bad_request(format!("Anda sudah melakukan check out, pada hari ini {iso}")));
    }

    let updated = app_state
        .db_client
        .update_check_out_attendance_session(session_id, Some(now))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let fence_row = app_state
        .db_client
        .find_geofence(geofence_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let add_row = AddAttendanceEvent {
        session_id,
        satker_id: user_claims.user_claims.satker_id,
        user_id: user_claims.user_claims.user_id,
        event_type: AttendanceEventType::CheckOut,
        now,
        latitude: Some(payload.latitude),
        longitude: Some(payload.longitude),
        accuracy_meters: payload.accuracy_meters,
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        selfie_object_key: payload.selfie_object_key,
        liveness_score: payload.liveness_score,
        face_match_score: payload.face_match_score,
        device_id: payload.device_id,
        client_version: payload.client_version,
        server_challenge_id: Some(payload.challenge_id),
        device_model: payload.device_model,
        android_version: payload.android_version,
        app_build: payload.app_build,
        attendance_leave_type: leave_type,
        attendance_leave_notes: leave_notes,
    };

    app_state
        .db_client
        .add_attendance_event(add_row)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    // Optional: record apel (laporan) if requested and eligible.
    // Eligibility rules (backend authority):
    // - harus di dalam geofence (out_of_fence == false)
    // - bukan konteks duty schedule (used_duty == false)
    // - masih dalam window apel: now <= work_start + 2 jam
    if payload.apel.unwrap_or(false) && !out_of_fence && !used_duty {
        let (work_start, _work_end) = get_work_window_local(
            &app_state,
            user_claims.user_claims.satker_id,
            today,
        )
            .await?;

        let start_local = today.and_time(work_start);
        let work_start_dt = tz
            .from_local_datetime(&start_local)
            .single()
            .unwrap_or_else(|| tz.from_local_datetime(&start_local).earliest().unwrap());

        let apel_deadline = work_start_dt + Duration::hours(EARLY_CHECKIN_HOURS);
        if local_now <= apel_deadline {
            let _ = app_state
                .db_client
                .upsert_attendance_apel(
                    user_claims.user_claims.satker_id,
                    user_claims.user_claims.user_id,
                    today,
                    now,
                    "PAGI",
                    "CHECKOUT",
                )
                .await;
        }
    }

    let attendance_dto = AttendanceDto {
        session_id: updated.id,
        work_date: updated.work_date,
        check_in_at: updated.check_in_at.map(|t| t.into()),
        check_out_at: updated.check_out_at.map(|t| t.into()),
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        geofence_name: Some(fence_row.unwrap().name),
    };

    let response = AttendanceResp {
        status: "200",
        data: attendance_dto,
    };

    Ok(Json(response))
}

/// Endpoint untuk kebutuhan mobile attendance card.
///
/// Aturan:
/// 1) Jika ada attendance_session work_date hari ini -> kirim (is_duty=false)
/// 2) Jika tidak ada -> cek duty schedule hari ini (aktif / upcoming) -> kirim duty window (is_duty=true)
///    - jika session duty sudah ada (check-in) ikutkan check_in/out
/// 3) Jika tidak ada -> cek duty kemarin dengan session yang belum checkout (dan masih dalam grace)
/// 4) Fallback -> kirim kosong hari ini
pub async fn get_attendance_session_today(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let tz = get_timezone_cached(&app_state).await?;
    let now = Utc::now();
    let local_now = now.with_timezone(&tz);
    let today = local_now.date_naive();
    let yesterday = today - chrono::Days::new(1);

/*    // 1) Session hari ini
    if let Some(s) = app_state
        .db_client
        .find_attendance_session_by_user_date(user_claims.user_claims.user_id, today)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
    {
        let resp = AttendanceSessionTodayResp {
            status: "200",
            data: AttendanceSessionTodayDto {
                work_date: s.work_date,
                check_in_at: s.check_in_at,
                check_out_at: s.check_out_at,
                is_duty: false,
                duty_start_at: None,
                duty_end_at: None,
            },
        };
        return Ok(Json(resp));
    }*/

    // 1) Session hari ini
    if let Some(s) = app_state
        .db_client
        .find_attendance_session_by_user_date(user_claims.user_claims.user_id, today)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?
    {
        // Jika user sudah check-in lebih awal untuk duty yang start hari ini (mis. 18:35),
        // tetap tampilkan konteks duty agar user tidak bingung.
        if let Some(duty_today) = find_duty_by_local_date(
            &app_state,
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            &tz,
            today,
        )
            .await?
        {
            if duty_today.end_at + Duration::minutes(DUTY_CARD_GRACE_MINUTES) > now {
                let duty_work_date = duty_today.start_at.with_timezone(&tz).date_naive();
                if duty_work_date == s.work_date {
                    let resp = AttendanceSessionTodayResp {
                        status: "200",
                        data: AttendanceSessionTodayDto {
                            work_date: today,
                            check_in_at: s.check_in_at,
                            check_out_at: s.check_out_at,
                            is_duty: true,
                            duty_start_at: Some(duty_today.start_at),
                            duty_end_at: Some(duty_today.end_at),
                        },
                    };
                    return Ok(Json(resp));
                }
            }
        }

        let resp = AttendanceSessionTodayResp {
            status: "200",
            data: AttendanceSessionTodayDto {
                work_date: today,
                check_in_at: s.check_in_at,
                check_out_at: s.check_out_at,
                is_duty: false,
                duty_start_at: None,
                duty_end_at: None,
            },
        };
        return Ok(Json(resp));
    }

    // 2) Jika ada duty yang SEDANG AKTIF sekarang, kembalikan sebagai konteks duty.
    // Ini penting untuk shift lintas hari: mis. duty start kemarin malam dan berakhir hari ini pagi.
    if let Some(duty_active) = find_duty_now_for_card(
        &app_state,
        user_claims.user_claims.satker_id,
        user_claims.user_claims.user_id,
        now,
    )
        .await?
    {
        let duty_work_date = duty_active.start_at.with_timezone(&tz).date_naive();
        let sess = app_state
            .db_client
            .find_attendance_session_by_user_date(user_claims.user_claims.user_id, duty_work_date)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let (check_in_at, check_out_at) = sess
            .map(|s| (s.check_in_at, s.check_out_at))
            .unwrap_or((None, None));

        let resp = AttendanceSessionTodayResp {
            status: "200",
            data: AttendanceSessionTodayDto {
                work_date: today,
                check_in_at,
                check_out_at,
                is_duty: true,
                duty_start_at: Some(duty_active.start_at),
                duty_end_at: Some(duty_active.end_at),
            },
        };
        return Ok(Json(resp));
    }

    // 3) Duty hari ini (upcoming). Ini membantu UX: mis. buka app jam 19:00, duty jam 20:00.
    if let Some(duty_today) = find_duty_by_local_date(
        &app_state,
        user_claims.user.satker_id,
        user_claims.user_claims.user_id,
        &tz,
        today,
    )
        .await?
    {
        // Hanya tampilkan kalau duty belum berakhir.
        if duty_today.end_at + Duration::minutes(DUTY_CARD_GRACE_MINUTES) > now {
            let duty_work_date = duty_today.start_at.with_timezone(&tz).date_naive();
            let sess = app_state
                .db_client
                .find_attendance_session_by_user_date(user_claims.user_claims.user_id, duty_work_date)
                .await
                .map_err(|e| HttpError::server_error(e.to_string()))?;

            let (check_in_at, check_out_at) = sess
                .map(|s| (s.check_in_at, s.check_out_at))
                .unwrap_or((None, None));

            let resp = AttendanceSessionTodayResp {
                status: "200",
                data: AttendanceSessionTodayDto {
                    work_date: today,
                    check_in_at,
                    check_out_at,
                    is_duty: true,
                    duty_start_at: Some(duty_today.start_at),
                    duty_end_at: Some(duty_today.end_at),
                },
            };
            return Ok(Json(resp));
        }
    }

    // 4) Duty kemarin yang belum checkout (dan masih dalam grace window)
    if let Some(duty_yesterday) = find_duty_by_local_date(
        &app_state,
        user_claims.user.satker_id,
        user_claims.user_claims.user_id,
        &tz,
        yesterday,
    )
        .await?
    {
        let duty_work_date = duty_yesterday.start_at.with_timezone(&tz).date_naive();
        if let Some(s) = app_state
            .db_client
            .find_attendance_session_by_user_date(user_claims.user_claims.user_id, duty_work_date)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
        {
            if s.check_in_at.is_some() && s.check_out_at.is_none() {
                let grace_until = duty_yesterday.end_at + Duration::hours(DUTY_GRACE_HOURS);
                if now <= grace_until {
                    let resp = AttendanceSessionTodayResp {
                        status: "200",
                        data: AttendanceSessionTodayDto {
                            work_date: today,
                            check_in_at: s.check_in_at,
                            check_out_at: s.check_out_at,
                            is_duty: true,
                            duty_start_at: Some(duty_yesterday.start_at),
                            duty_end_at: Some(duty_yesterday.end_at),
                        },
                    };
                    return Ok(Json(resp));
                }
            }
        }
    }

    // 5) Fallback: kosong hari ini
    let resp = AttendanceSessionTodayResp {
        status: "200",
        data: AttendanceSessionTodayDto {
            work_date: today,
            check_in_at: None,
            check_out_at: None,
            is_duty: false,
            duty_start_at: None,
            duty_end_at: None,
        },
    };
    Ok(Json(resp))
}
async fn nearest_geofence(
    app_state: &Arc<AppState>,
    satker_id: Uuid,
    lat: f64,
    lon: f64,
) -> Result<Option<(Uuid, f64, i32)>, HttpError> {
    let geos = app_state
        .db_client
        .list_active_geofences_by_satker(satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if geos.is_empty() {
        return Ok(None);
    }

    let mut best: Option<(Uuid, f64, i32)> = Option::None;

    for g in geos {
        let d = haversine_m(lat, lon, g.latitude, g.longitude);
        match best {
            None => best = Some((g.id, d, g.radius_meters)),
            Some((_, best_d, _)) if d < best_d => best = Some((g.id, d, g.radius_meters)),
            _ => {}
        }
    }

    Ok(best)
}

/*pub async fn check_in(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<AttendanceReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    /*
    validate_and_use_challenge(&app_state, &user_claims.user_claims, payload.challenge_id)
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

     */

    let device_id = payload.device_id.clone()
        .ok_or(HttpError::bad_request("device_id wajib".to_string()))?;

    app_state.db_client
        .ensure_device_bound_first_user(
            user_claims.user_claims.user_id,
            &device_id,
            payload.device_model.clone(),
            payload.android_version.clone(),
            payload.app_build.clone(),
            payload.client_version.clone(),
        ).await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    // ✅ reject mock
    if payload.is_mock.unwrap_or(false) {
        return Err(HttpError::bad_request("mock location terdeteksi".to_string()));
    }

    // ✅ reject location too old
    /*if let Some(age) = payload.location_age_ms {
        if age > 10_000 {
            return Err(HttpError::bad_request("lokasi terlalu lama, silakan refresh lokasi".to_string()));
        }
    }*/

    // ✅ reject accuracy too poor
    if let Some(acc) = payload.accuracy_meters {
        if acc > 50.0 {
            return Err(HttpError::bad_request("akurasi lokasi terlalu rendah, silakan coba lagi".to_string()));
        }
    }

    validate_and_use_challenge(
        &app_state,
        &user_claims.user_claims,
        payload.challenge_id,
        &device_id, // ✅ bind device
    ).await?;

    anti_teleport_check(
        &app_state,
        user_claims.user_claims.user_id,
        &device_id,
        payload.latitude,
        payload.longitude,
    ).await?;

    let nearest = nearest_geofence(
        &app_state,
        user_claims.user_claims.satker_id,
        payload.latitude,
        payload.longitude,
    )
    .await
    .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let (geofence_id, distance_m, radius_m) = nearest.ok_or(HttpError::bad_request(
        "geofence aktif belum diset untuk satker ini".to_string(),
    ))?;

    /*if distance_m > radius_m as f64 {
        return Err(HttpError::bad_request(format!(
            "di luar geofence: jarak {:.1}m > radius {}m",
            distance_m, radius_m
        )));
    }*/

    let out_of_fence = distance_m > radius_m as f64;

    let mut leave_type = payload.leave_type.clone().unwrap_or(AttendanceLeaveType::Normal);
    let leave_notes = payload.leave_notes.clone();

    if out_of_fence {
        if matches!(leave_type, AttendanceLeaveType::Normal) {
            return Err(HttpError::bad_request(format!(
                "di luar geofence: jarak {:.1}m > radius {}m. Pilih jenis izin/dinas terlebih dahulu",
                distance_m, radius_m
            )));
        }
    } else {
        leave_type = AttendanceLeaveType::Normal;
    }

    let now = Utc::now();

    //let now_wib = now.with_timezone(&Jakarta);
    //let work_date = now_wib.date_naive();
    let tz = get_timezone_cached(&app_state).await?;
    let work_date = now.with_timezone(&tz).date_naive();

    let session_id = app_state
        .db_client
        .upsert_attendance_session(
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            work_date,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let attendance_event_row = app_state
        .db_client
        .find_attendance_event_by_session(session_id, AttendanceEventType::CheckIn)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if let Some(_) = attendance_event_row {

        let sess_check_in = app_state.db_client
            .find_attendance_session(session_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

        let session_hour = sess_check_in.check_in_at.unwrap();
        let iso = session_hour.to_rfc3339();

        return Err(HttpError::bad_request(format!("Anda sudah melakukan check in, pada hari ini {iso}")));
    }

    let updated = app_state
        .db_client
        .update_check_in_attendance_session(session_id, Some(now))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let fence_row = app_state
        .db_client
        .find_geofence(geofence_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let add_row = AddAttendanceEvent {
        session_id,
        satker_id: user_claims.user_claims.satker_id,
        user_id: user_claims.user_claims.user_id,
        event_type: AttendanceEventType::CheckIn,
        now,
        latitude: Some(payload.latitude),
        longitude: Some(payload.longitude),
        accuracy_meters: payload.accuracy_meters,
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        selfie_object_key: payload.selfie_object_key,
        liveness_score: payload.liveness_score,
        face_match_score: payload.face_match_score,
        device_id: payload.device_id,
        client_version: payload.client_version,
        server_challenge_id: Some(payload.challenge_id),
        device_model: payload.device_model,
        android_version: payload.android_version,
        app_build: payload.app_build,
        attendance_leave_type: leave_type,
        attendance_leave_notes: leave_notes,
    };

    app_state
        .db_client
        .add_attendance_event(add_row)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let attendance_dto = AttendanceDto {
        session_id: updated.id,
        work_date: updated.work_date,
        check_in_at: updated.check_in_at.map(|t| t.into()),
        check_out_at: updated.check_out_at.map(|t| t.into()),
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        geofence_name: Some(fence_row.unwrap().name),
    };

    let response = AttendanceResp {
        status: "200",
        data: attendance_dto,
    };

    Ok(Json(response))
}

pub async fn check_out(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<AttendanceReq>,
) -> Result<impl IntoResponse, HttpError> {
    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;
    /*
    validate_and_use_challenge(&app_state, &user_claims.user_claims, payload.challenge_id)
        .await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

     */

    let device_id = payload.device_id.clone()
        .ok_or(HttpError::bad_request("device_id wajib".to_string()))?;

    app_state.db_client
        .ensure_device_bound_first_user(
            user_claims.user_claims.user_id,
            &device_id,
            payload.device_model.clone(),
            payload.android_version.clone(),
            payload.app_build.clone(),
            payload.client_version.clone(),
        ).await
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    // ✅ reject mock
    if payload.is_mock.unwrap_or(false) {
        return Err(HttpError::bad_request("mock location terdeteksi".to_string()));
    }

    // ✅ reject location too old
   /* if let Some(age) = payload.location_age_ms {
        if age > 10_000 {
            return Err(HttpError::bad_request("lokasi terlalu lama, silakan refresh lokasi".to_string()));
        }
    }*/

    // ✅ reject accuracy too poor
    if let Some(acc) = payload.accuracy_meters {
        if acc > 50.0 {
            return Err(HttpError::bad_request("akurasi lokasi terlalu rendah, silakan coba lagi".to_string()));
        }
    }

    validate_and_use_challenge(
        &app_state,
        &user_claims.user_claims,
        payload.challenge_id,
        &device_id, // ✅ bind device
    ).await?;

    anti_teleport_check(
        &app_state,
        user_claims.user_claims.user_id,
        &device_id,
        payload.latitude,
        payload.longitude,
    ).await?;

    let nearest = nearest_geofence(
        &app_state,
        user_claims.user_claims.satker_id,
        payload.latitude,
        payload.longitude,
    )
    .await
    .map_err(|e| HttpError::bad_request(e.to_string()))?;

    let (geofence_id, distance_m, radius_m) = nearest.ok_or(HttpError::bad_request(
        "geofence aktif belum diset untuk satker ini".to_string(),
    ))?;

   /* if distance_m > radius_m as f64 {
        return Err(HttpError::bad_request(format!(
            "di luar geofence: jarak {:.1}m > radius {}m",
            distance_m, radius_m
        )));
    }*/

    let out_of_fence = distance_m > radius_m as f64;

    let mut leave_type = payload.leave_type.clone().unwrap_or(AttendanceLeaveType::Normal);
    let leave_notes = payload.leave_notes.clone();

    if out_of_fence {
        if matches!(leave_type, AttendanceLeaveType::Normal) {
            return Err(HttpError::bad_request(format!(
                "di luar geofence: jarak {:.1}m > radius {}m. Pilih jenis izin/dinas terlebih dahulu",
                distance_m, radius_m
            )));
        }
    } else {
        leave_type = AttendanceLeaveType::Normal;
    }

    let now = Utc::now();
    //let now_wib = now.with_timezone(&Jakarta);
    //let work_date = now_wib.date_naive();
    let tz = get_timezone_cached(&app_state).await?;
    let work_date = now.with_timezone(&tz).date_naive();

    let session_id = app_state
        .db_client
        .upsert_attendance_session(
            user_claims.user_claims.satker_id,
            user_claims.user_claims.user_id,
            work_date,
        )
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let sess = app_state
        .db_client
        .find_attendance_session(session_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if sess.check_in_at.is_none() {
        return Err(HttpError::bad_request("belum check-in".to_string()));
    }

    let attendance_event_row = app_state
        .db_client
        .find_attendance_event_by_session(session_id, AttendanceEventType::CheckOut)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if let Some(_) = attendance_event_row {

        let sess_check_in = app_state.db_client
            .find_attendance_session(session_id)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        let session_hour = sess_check_in.check_out_at.unwrap();
        let iso = session_hour.to_rfc3339();

        return Err(HttpError::bad_request(format!("Anda sudah melakukan check out, pada hari ini {iso}")));
    }

    let updated = app_state
        .db_client
        .update_check_out_attendance_session(session_id, Some(now))
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let fence_row = app_state
        .db_client
        .find_geofence(geofence_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let add_row = AddAttendanceEvent {
        session_id,
        satker_id: user_claims.user_claims.satker_id,
        user_id: user_claims.user_claims.user_id,
        event_type: AttendanceEventType::CheckOut,
        now,
        latitude: Some(payload.latitude),
        longitude: Some(payload.longitude),
        accuracy_meters: payload.accuracy_meters,
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        selfie_object_key: payload.selfie_object_key,
        liveness_score: payload.liveness_score,
        face_match_score: payload.face_match_score,
        device_id: payload.device_id,
        client_version: payload.client_version,
        server_challenge_id: Some(payload.challenge_id),
        device_model: payload.device_model,
        android_version: payload.android_version,
        app_build: payload.app_build,
        attendance_leave_type: leave_type,
        attendance_leave_notes: leave_notes,
    };

    app_state
        .db_client
        .add_attendance_event(add_row)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let attendance_dto = AttendanceDto {
        session_id: updated.id,
        work_date: updated.work_date,
        check_in_at: updated.check_in_at.map(|t| t.into()),
        check_out_at: updated.check_out_at.map(|t| t.into()),
        geofence_id: Some(geofence_id),
        distance_to_fence_m: Some(distance_m),
        geofence_name: Some(fence_row.unwrap().name),
    };

    let response = AttendanceResp {
        status: "200",
        data: attendance_dto,
    };

    Ok(Json(response))
}*/

pub async fn find_attendance(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {

    let now = Utc::now();
    let now_wib = now.with_timezone(&Jakarta);
    let work_date = now_wib.date_naive();


    let row = app_state
    .db_client
        .find_attendance_by_user_work_date(
            work_date,
            user_claims.user_claims.user_id,
        ).await
    .map_err(|e| HttpError::server_error(e.to_string()))?;

    let mut dto = AttendanceRekapDto::default();

    if let Some(row) = row {
        dto.session_id = row.session_id;
        dto.work_date = row.work_date;
        dto.user_id = row.user_id;
        dto.full_name = row.full_name;
        dto.nrp = row.nrp;
        dto.check_in_at = row.check_in_at.map(|t| t.into());
        dto.check_out_at = row.check_out_at.map(|t| t.into());
        dto.check_in_geofence_id = row.check_in_geofence_id.map(|t| t.into());
        dto.check_out_geofence_id = row.check_out_geofence_id.map(|t| t.into());
        dto.check_in_distance_to_fence_m = row.check_in_distance_to_fence_m.map(|t| t.into());
        dto.check_out_distance_to_fence_m = row.check_out_distance_to_fence_m.map(|t| t.into());
        dto.check_in_geofence_name = row.check_in_geofence_name.map(|t| t.into());
        dto.check_out_geofence_name = row.check_out_geofence_name.map(|t| t.into());
        dto.check_in_latitude = row.check_in_latitude.map(|t| t.into());
        dto.check_in_longitute = row.check_in_longitute.map(|t| t.into());
        dto.check_out_latitude = row.check_out_latitude.map(|t| t.into());
        dto.check_out_longitute = row.check_out_longitute.map(|t| t.into());
        dto.check_in_selfie_object_key = row.check_in_selfie_object_key.map(|t| t.into());
        dto.check_out_selfie_object_key = row.check_out_selfie_object_key.map(|t| t.into());
        dto.check_in_accuracy_meters = row.check_in_accuracy_meters;
        dto.check_out_accuracy_meters = row.check_out_accuracy_meters;
        dto.check_in_attendance_leave_type = row.check_in_attendance_leave_type.map(|t| t.into());
        dto.check_out_attendance_leave_type = row.check_out_attendance_leave_type.map(|t| t.into());
        dto.check_in_attendance_leave_notes = row.check_in_attendance_leave_notes.map(|t| t.into());
        dto.check_out_attendance_leave_notes = row.check_out_attendance_leave_notes.map(|t| t.into());
        dto.check_in_device_id = row.check_in_device_id.map(|t| t.into());
        dto.check_out_device_id = row.check_out_device_id.map(|t| t.into());
        dto.check_in_device_model = row.check_in_device_model.map(|t| t.into());
        dto.check_out_device_model = row.check_out_device_model.map(|t| t.into());
        dto.check_in_device_name = row.check_in_device_name.map(|t| t.into());
        dto.check_out_device_name = row.check_out_device_name.map(|t| t.into());

    } else {
        dto.session_id = Uuid::new_v4();
        dto.work_date = work_date;
        dto.user_id = user_claims.user.id;
        dto.full_name = user_claims.user.full_name;
        dto.nrp = user_claims.user.nrp;

    }


    let response = AttendanceRekapDtoResp {
        status: "200",
        data: dto,
    };

    Ok(Json(response))
}


pub async fn list_attendances(
    Query(query_params): Query<AttendanceRekapDtoQuery>,
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    query_params
        .validate()
        .map_err(|e| HttpError::bad_request(format!("validate error: {}", e)))?;

    let rows = if let Some(uid) = query_params.user_id {
        app_state
            .db_client
            .list_attendance_by_user_from_to(uid, query_params.from, query_params.to)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    } else {
        app_state
            .db_client
            .list_attendance_by_user_from_to(user_claims.user_claims.user_id, query_params.from, query_params.to)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?
    };

    let response = AttendanceRekapsDtoResp {
        status: "200",
        data: rows,
    };

    Ok(Json(response).into_response())
}