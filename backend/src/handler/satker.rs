use crate::AppState;
use crate::database::satker::SatkerRepo;
use crate::dtos::SuccessResponse;
use crate::dtos::satker::{CreateSatkerReq, SatkerDto, SatkerResp, SatkersResp, UpdateSatkerReq};
use crate::error::{ErrorMessage, HttpError};
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::utils::password::hash_password;
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;
use crate::constants::SUPERUSER_SATKER_ID;
use crate::database::holiday::HolidayRepo;
use crate::database::work_calendar::WorkCalendarRepo;
use crate::database::work_pattern::{WorkPatternRepo, pick_effective_pattern, WorkPatternUpsert};
use crate::dtos::work_calendar::{GenerateCalendarQuery, GenerateCalendarResp, GenerateCalendarRespData};
use crate::dtos::work_calendar::{ListCalendarQuery, ListCalendarResp};
use crate::constants::{CalendarDayType, HolidayKind};
use chrono::{Datelike, Weekday, NaiveTime, NaiveDate};
use crate::dtos::work_pattern::{UpsertWorkPatternReq, UpsertWorkPatternResp, WorkPatternsResp};

pub fn satker_handler() -> Router {
    Router::new()
        .route("/", get(get_satker))
        .route("/{id}", get(find_satker))
        .route("/{id}/work-patterns", get(list_work_patterns).post(upsert_work_pattern))
        .route("/{id}/work-patterns/{effective_from}", delete(delete_work_pattern))
        .route("/{id}/calendar", get(list_calendar_days))
        .route("/{id}/calendar/generate", post(generate_calendar))
        .route("/create", post(create_satker))
        .route("/update/{id}", put(update_satker))
        .route("/delete/{id}", delete(delete_satker))
}

pub async fn list_calendar_days(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(satker_id): Path<Uuid>,
    Query(q): Query<ListCalendarQuery>,
) -> Result<impl IntoResponse, HttpError> {
    let role = user_claims.user_claims.role;
    let allowed = role == crate::auth::rbac::UserRole::Superadmin
        || ((role == crate::auth::rbac::UserRole::SatkerAdmin
        || role == crate::auth::rbac::UserRole::SatkerHead)
        && user_claims.user_claims.satker_id == satker_id);
    if !allowed {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if q.to < q.from {
        return Err(HttpError::bad_request("to: harus >= from"));
    }

    let rows = app_state
        .db_client
        .list_calendar_days(satker_id, q.from, q.to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(ListCalendarResp {
        status: "200".to_string(),
        data: rows,
    }))
}

pub async fn create_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Json(payload): Json<CreateSatkerReq>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satkers() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    payload
        .validate()
        .map_err(|e| HttpError::bad_request(e.to_string()))?;

    app_state
        .db_client
        .create_satker(payload.code, payload.name)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully created satker".to_string(),
    }))
}

pub async fn update_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateSatkerReq>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satkers() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    app_state
        .db_client
        .update_satker(id, payload.code, payload.name)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully updated satker".to_string(),
    }))
}

pub async fn delete_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    if user_claims.user_claims.role.can_manage_satkers() == false {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if id == SUPERUSER_SATKER_ID {
        return Err(HttpError::bad_request("forbidden, superuser satker tidak boleh di hapus".to_string()));
    }

    app_state
        .db_client
        .delete_satker(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sucessfully deleted satker".to_string(),
    }))
}

pub async fn find_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    let row = app_state
        .db_client
        .find_satker_by_id(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satker = row.ok_or(HttpError::bad_request("no satker found"))?;

    let satker_dto = SatkerDto::to_row(&satker);

    Ok(Json(SatkerResp {
        status: "200",
        data: satker_dto,
    }))
}

pub async fn get_satker(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(_user_claims): Extension<AuthMiddleware>,
) -> Result<impl IntoResponse, HttpError> {
    let rows = app_state
        .db_client
        .get_satker_all()
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let satker_dto = SatkerDto::to_rows(&rows);

    Ok(Json(SatkersResp {
        status: "200",
        data: satker_dto,
    }))
}


fn weekday_is_work(pattern: &crate::models::SatkerWorkPattern, weekday: Weekday) -> bool {
    match weekday {
        Weekday::Mon => pattern.mon_work,
        Weekday::Tue => pattern.tue_work,
        Weekday::Wed => pattern.wed_work,
        Weekday::Thu => pattern.thu_work,
        Weekday::Fri => pattern.fri_work,
        Weekday::Sat => pattern.sat_work,
        Weekday::Sun => pattern.sun_work,
    }
}

pub async fn generate_calendar_first(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Query(q): Query<GenerateCalendarQuery>,
) -> Result<impl IntoResponse, HttpError> {
    // Authz: Superadmin any satker; SatkerAdmin/SatkerHead only own satker.
    let role = user_claims.user_claims.role;
    let allowed = role.can_manage_satkers() // superadmin
        || ((role == crate::auth::rbac::UserRole::SatkerAdmin || role == crate::auth::rbac::UserRole::SatkerHead)
        && user_claims.user_claims.satker_id == id);

    if !allowed {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if q.to < q.from {
        return Err(HttpError::bad_request("to: harus >= from"));
    }

    let patterns = app_state
        .db_client
        .list_work_patterns(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if patterns.is_empty() {
        return Err(HttpError::bad_request(
            "satker_work_patterns: belum ada, isi dulu pattern kerja satker",
        ));
    }

    let holidays = app_state
        .db_client
        .list_holidays(id, q.from, q.to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let mut holiday_by_date: std::collections::HashMap<NaiveDate, crate::models::Holiday> =
        std::collections::HashMap::new();
    for h in holidays {
        // If there are both NATIONAL and SATKER on same date, SATKER should win.
        let replace = match holiday_by_date.get(&h.holiday_date) {
            None => true,
            Some(existing) => existing.scope == crate::constants::HolidayScope::National && h.scope == crate::constants::HolidayScope::Satker,
        };
        if replace {
            holiday_by_date.insert(h.holiday_date, h);
        }
    }

    let mut date = q.from;
    let mut generated: i64 = 0;
    while date <= q.to {
        let pattern = pick_effective_pattern(&patterns, date)
            .ok_or_else(|| HttpError::bad_request("work pattern tidak ditemukan untuk tanggal ini"))?;

        let weekday = date.weekday();
        let is_work = weekday_is_work(&pattern, weekday);

        let mut day_type = if is_work {
            // default half day rule: if Saturday work and half_day_end present => half day
            if weekday == Weekday::Sat && pattern.half_day_end.is_some() {
                CalendarDayType::HalfDay
            } else {
                CalendarDayType::Workday
            }
        } else {
            CalendarDayType::Holiday
        };

        let mut expected_start: Option<NaiveTime> = None;
        let mut expected_end: Option<NaiveTime> = None;
        let mut note: Option<String> = None;

        if is_work {
            expected_start = Some(pattern.work_start);
            expected_end = Some(
                if day_type == CalendarDayType::HalfDay {
                    pattern.half_day_end.unwrap_or(pattern.work_end)
                } else {
                    pattern.work_end
                },
            );
        } else {
            note = Some("LIBUR".to_string());
        }

        // Apply holiday override (national/satker)
        if let Some(h) = holiday_by_date.get(&date) {
            match h.kind {
                HolidayKind::Holiday => {
                    day_type = CalendarDayType::Holiday;
                    expected_start = None;
                    expected_end = None;
                }
                HolidayKind::HalfDay => {
                    day_type = CalendarDayType::HalfDay;
                    // If it's a workday, keep start; ensure end is set.
                    if expected_start.is_none() {
                        expected_start = Some(pattern.work_start);
                    }
                    expected_end = Some(
                        h.half_day_end
                            .or(pattern.half_day_end)
                            .unwrap_or(pattern.work_end),
                    );
                }
            }
            note = Some(h.name.clone());
        }

        app_state
            .db_client
            .upsert_calendar_day(id, date, day_type, expected_start, expected_end, note)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        generated += 1;
        date = date.succ_opt().ok_or_else(|| HttpError::server_error("invalid date"))?;
    }

    Ok(Json(GenerateCalendarResp {
        status: "200".to_string(),
        data: GenerateCalendarRespData {
            days_generated: generated,
        },
    }))
}

fn is_workday(pattern: &crate::models::SatkerWorkPattern, weekday: Weekday) -> bool {
    match weekday {
        Weekday::Mon => pattern.mon_work,
        Weekday::Tue => pattern.tue_work,
        Weekday::Wed => pattern.wed_work,
        Weekday::Thu => pattern.thu_work,
        Weekday::Fri => pattern.fri_work,
        Weekday::Sat => pattern.sat_work,
        Weekday::Sun => pattern.sun_work,
    }
}


pub async fn generate_calendar(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(satker_id): Path<Uuid>,
    Query(q): Query<GenerateCalendarQuery>,
) -> Result<impl IntoResponse, HttpError> {
    // Authz
    let role = user_claims.user_claims.role;
    let allowed = role == crate::auth::rbac::UserRole::Superadmin
        || ((role == crate::auth::rbac::UserRole::SatkerAdmin
        || role == crate::auth::rbac::UserRole::SatkerHead)
        && user_claims.user_claims.satker_id == satker_id);
    if !allowed {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if q.to < q.from {
        return Err(HttpError::bad_request("to: harus >= from"));
    }

    // Constraint: generation should be done for a full year (so admin doesn't need to generate monthly).
    // Allowed for any year (including next year).
    /*{
        use chrono::Datelike;
        let y_from = q.from.year();
        let y_to = q.to.year();
        if y_from != y_to {
            return Err(HttpError::bad_request("range harus dalam 1 tahun yang sama"));
        }
        let is_full_year = q.from.month() == 1
            && q.from.day() == 1
            && q.to.month() == 12
            && q.to.day() == 31;
        if !is_full_year {
            return Err(HttpError::bad_request(
                "range harus 1 tahun penuh: 01-01 s/d 12-31",
            ));
        }
    }*/

    // Guard: do not generate absurdly large ranges
    let max_days: i64 = 370;
    let days = (q.to - q.from).num_days() + 1;
    if days > max_days {
        return Err(HttpError::bad_request(format!(
            "range terlalu besar (max {} hari)",
            max_days
        )));
    }

    let patterns = app_state
        .db_client
        .list_work_patterns(satker_id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if patterns.is_empty() {
        return Err(HttpError::bad_request(
            "satker_work_patterns belum diset untuk satker ini",
        ));
    }

    let holidays = app_state
        .db_client
        .list_holidays(satker_id, q.from, q.to)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    let mut holiday_by_date: std::collections::HashMap<NaiveDate, crate::models::Holiday> =
        std::collections::HashMap::new();
    for h in holidays {
        // If there are both NATIONAL and SATKER on same date, SATKER should win.
        let replace = match holiday_by_date.get(&h.holiday_date) {
            None => true,
            Some(existing) => {
                existing.scope == crate::constants::HolidayScope::National
                    && h.scope == crate::constants::HolidayScope::Satker
            }
        };
        if replace {
            holiday_by_date.insert(h.holiday_date, h);
        }
    }

    let mut generated: i64 = 0;
    let mut cur = q.from;
    while cur <= q.to {
        let weekday = cur.weekday();
        let pattern = pick_effective_pattern(&patterns, cur).ok_or_else(|| {
            HttpError::bad_request(format!(
                "work pattern tidak ditemukan untuk tanggal {}",cur
            ))
        })?;

        let mut day_type = if is_workday(&pattern, weekday) {
            CalendarDayType::Workday
        } else {
            CalendarDayType::Holiday
        };

        let mut expected_start: Option<NaiveTime> = None;
        let mut expected_end: Option<NaiveTime> = None;
        let mut note: Option<String> = None;

        if day_type == CalendarDayType::Workday {
            expected_start = Some(pattern.work_start);
            expected_end = Some(pattern.work_end);
            // Half-day rule: if sat_work and pattern has half_day_end and today is Saturday
            if weekday == Weekday::Sat {
                if let Some(half_end) = pattern.half_day_end {
                    day_type = CalendarDayType::HalfDay;
                    expected_end = Some(half_end);
                }
            }
        } else {
            note = Some("Hari libur".to_string());
        }

        // Override with holiday table
        if let Some(h) = holiday_by_date.get(&cur) {
            match h.kind {
                HolidayKind::Holiday => {
                    day_type = CalendarDayType::Holiday;
                    expected_start = None;
                    expected_end = None;
                    note = Some(h.name.clone());
                }
                HolidayKind::HalfDay => {
                    day_type = CalendarDayType::HalfDay;
                    expected_start = Some(pattern.work_start);
                    let end = h.half_day_end.or(pattern.half_day_end).unwrap_or(pattern.work_end);
                    expected_end = Some(end);
                    note = Some(h.name.clone());
                }
            }
        }

        app_state
            .db_client
            .upsert_calendar_day(satker_id, cur, day_type, expected_start, expected_end, note)
            .await
            .map_err(|e| HttpError::server_error(e.to_string()))?;

        generated += 1;
        cur = cur.succ_opt().unwrap();
    }

    Ok(Json(GenerateCalendarResp {
        status: "200".to_string(),
        data: GenerateCalendarRespData {
            days_generated: generated,
        },
    }))
}

fn parse_time(s: String, field: &str) -> Result<NaiveTime, HttpError> {
    NaiveTime::parse_from_str(&s, "%H:%M")
        .or_else(|_| NaiveTime::parse_from_str(&s, "%H:%M:%S"))
        .map_err(|_| HttpError::bad_request(format!("{}: format jam tidak valid ({})", field, s)))
}

fn parse_time_opt(s: Option<String>, field: &str) -> Result<Option<NaiveTime>, HttpError> {
    match s {
        None => Ok(None),
        Some(v) => Ok(Some(parse_time(v, field)?)),
    }
}

pub async fn list_work_patterns(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    // Authz: Superadmin any satker; SatkerAdmin/SatkerHead only own satker.
    let role = user_claims.user_claims.role;
    let allowed = role.can_manage_satkers()
        || ((role == crate::auth::rbac::UserRole::SatkerAdmin || role == crate::auth::rbac::UserRole::SatkerHead)
        && user_claims.user_claims.satker_id == id);

    if !allowed {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let patterns = app_state
        .db_client
        .list_work_patterns(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(WorkPatternsResp {
        status: "200".to_string(),
        data: patterns,
    }))
}

pub async fn upsert_work_pattern(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpsertWorkPatternReq>,
) -> Result<impl IntoResponse, HttpError> {
    // Authz
    let role = user_claims.user_claims.role;
    let allowed = role.can_manage_satkers()
        || ((role == crate::auth::rbac::UserRole::SatkerAdmin || role == crate::auth::rbac::UserRole::SatkerHead)
        && user_claims.user_claims.satker_id == id);
    if !allowed {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let work_start = parse_time(payload.work_start, "work_start")?;
    let work_end = parse_time(payload.work_end, "work_end")?;
    let half_day_end = parse_time_opt(payload.half_day_end, "half_day_end")?;

    if work_end <= work_start {
        return Err(HttpError::bad_request("work_end: harus > work_start"));
    }
    if let Some(h) = half_day_end {
        if h <= work_start {
            return Err(HttpError::bad_request("half_day_end: harus > work_start"));
        }
        if h > work_end {
            return Err(HttpError::bad_request("half_day_end: tidak boleh > work_end"));
        }
    }

    let item = WorkPatternUpsert {
        effective_from: payload.effective_from,
        mon_work: payload.mon_work,
        tue_work: payload.tue_work,
        wed_work: payload.wed_work,
        thu_work: payload.thu_work,
        fri_work: payload.fri_work,
        sat_work: payload.sat_work,
        sun_work: payload.sun_work,
        work_start,
        work_end,
        half_day_end,
    };

    let saved = app_state
        .db_client
        .upsert_work_pattern(id, item)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    Ok(Json(UpsertWorkPatternResp {
        status: "200".to_string(),
        data: saved,
    }))
}

pub async fn delete_work_pattern(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path((id, effective_from)): Path<(Uuid, String)>,
) -> Result<impl IntoResponse, HttpError> {
    // Authz
    let role = user_claims.user_claims.role;
    let allowed = role.can_manage_satkers()
        || ((role == crate::auth::rbac::UserRole::SatkerAdmin || role == crate::auth::rbac::UserRole::SatkerHead)
        && user_claims.user_claims.satker_id == id);
    if !allowed {
        return Err(HttpError::unauthorized("forbidden"));
    }

    let date = chrono::NaiveDate::parse_from_str(&effective_from, "%Y-%m-%d")
        .map_err(|_| HttpError::bad_request("effective_from: format harus YYYY-MM-DD"))?;

    // Safety rule: hanya boleh hapus work pattern yang paling lama berdasarkan created_at.
    // Minimal harus tersisa 1 work pattern.
    let patterns = app_state
        .db_client
        .list_work_patterns(id)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if patterns.len() < 2 {
        return Err(HttpError::bad_request("minimal harus ada 1 work pattern"));
    }

    let mut by_created = patterns.clone();
    by_created.sort_by_key(|p| p.created_at);
    let oldest = by_created
        .first()
        .ok_or_else(|| HttpError::server_error("work pattern kosong"))?;

    if oldest.effective_from != date {
        return Err(HttpError::unauthorized("hanya boleh menghapus work pattern yang paling lama (berdasarkan created_at)"));
    }

    let affected = app_state
        .db_client
        .delete_work_pattern(id, date)
        .await
        .map_err(|e| HttpError::server_error(e.to_string()))?;

    if affected == 0 {
        return Err(HttpError::bad_request("work pattern tidak ditemukan"));
    }

    Ok(Json(SuccessResponse {
        status: "200".to_string(),
        data: "Sukses delete work pattern".to_string(),
    }))
}
