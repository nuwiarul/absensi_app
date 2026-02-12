use crate::AppState;
use crate::constants::{CalendarDayType, HolidayKind, SUPERUSER_SATKER_ID};
use crate::database::holiday::HolidayRepo;
use crate::database::satker::SatkerRepo;
use crate::database::work_calendar::WorkCalendarRepo;
use crate::database::work_pattern::{WorkPatternRepo, WorkPatternUpsert, pick_effective_pattern};
use crate::dtos::SuccessResponse;
use crate::dtos::satker::{CreateSatkerReq, SatkerDto, SatkerResp, SatkersResp, UpdateSatkerReq};
use crate::dtos::work_calendar::{
    GenerateCalendarQuery, GenerateCalendarResp, GenerateCalendarRespData,
};
use crate::dtos::work_calendar::{ListCalendarQuery, ListCalendarResp};
use crate::dtos::work_pattern::{UpsertWorkPatternReq, UpsertWorkPatternResp, WorkPatternsResp};
use crate::error::HttpError;
use crate::middleware::auth_middleware::AuthMiddleware;
use crate::services::authorization::ensure_can_access_satker;
use crate::services::calendar::{build_holiday_override_map, weekday_is_work};
use crate::services::catalog::load_satkers_and_ranks;
use crate::utils::time_parser::{parse_optional_time_field, parse_time_field};
use axum::extract::{Path, Query};
use axum::response::IntoResponse;
use axum::routing::{delete, get, post, put};
use axum::{Extension, Json, Router};
use chrono::{Datelike, NaiveDate, NaiveTime, Weekday};
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

pub fn satker_handler() -> Router {
    Router::new()
        .route("/", get(get_satker))
        .route("/{id}", get(find_satker))
        .route(
            "/{id}/work-patterns",
            get(list_work_patterns).post(upsert_work_pattern),
        )
        .route(
            "/{id}/work-patterns/{effective_from}",
            delete(delete_work_pattern),
        )
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
    ensure_can_access_satker(&user_claims.user_claims, satker_id)?;

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
    if !user_claims.user_claims.role.can_manage_satkers() {
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
    if !user_claims.user_claims.role.can_manage_satkers() {
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
    if !user_claims.user_claims.role.can_manage_satkers() {
        return Err(HttpError::unauthorized("forbidden"));
    }

    if id == SUPERUSER_SATKER_ID {
        return Err(HttpError::bad_request(
            "forbidden, superuser satker tidak boleh di hapus".to_string(),
        ));
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
    let (satkers, _) = load_satkers_and_ranks(&app_state.db_client).await?;
    let satker_dto = SatkerDto::to_rows(&satkers);

    Ok(Json(SatkersResp {
        status: "200",
        data: satker_dto,
    }))
}

pub async fn generate_calendar_first(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
    Query(q): Query<GenerateCalendarQuery>,
) -> Result<impl IntoResponse, HttpError> {
    ensure_can_access_satker(&user_claims.user_claims, id)?;

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

    let holiday_by_date = build_holiday_override_map(holidays);

    let mut date = q.from;
    let mut generated: i64 = 0;
    while date <= q.to {
        let pattern = pick_effective_pattern(&patterns, date).ok_or_else(|| {
            HttpError::bad_request("work pattern tidak ditemukan untuk tanggal ini")
        })?;

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
            expected_end = Some(if day_type == CalendarDayType::HalfDay {
                pattern.half_day_end.unwrap_or(pattern.work_end)
            } else {
                pattern.work_end
            });
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
        date = date
            .succ_opt()
            .ok_or_else(|| HttpError::server_error("invalid date"))?;
    }

    Ok(Json(GenerateCalendarResp {
        status: "200".to_string(),
        data: GenerateCalendarRespData {
            days_generated: generated,
        },
    }))
}

pub async fn generate_calendar(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(satker_id): Path<Uuid>,
    Query(q): Query<GenerateCalendarQuery>,
) -> Result<impl IntoResponse, HttpError> {
    ensure_can_access_satker(&user_claims.user_claims, satker_id)?;

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

    let holiday_by_date = build_holiday_override_map(holidays);

    let mut generated: i64 = 0;
    let mut cur = q.from;
    while cur <= q.to {
        let weekday = cur.weekday();
        let pattern = pick_effective_pattern(&patterns, cur).ok_or_else(|| {
            HttpError::bad_request(format!(
                "work pattern tidak ditemukan untuk tanggal {}",
                cur
            ))
        })?;

        let mut day_type = if weekday_is_work(&pattern, weekday) {
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
            if weekday == Weekday::Sat
                && let Some(half_end) = pattern.half_day_end
            {
                day_type = CalendarDayType::HalfDay;
                expected_end = Some(half_end);
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
                    let end = h
                        .half_day_end
                        .or(pattern.half_day_end)
                        .unwrap_or(pattern.work_end);
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

pub async fn list_work_patterns(
    Extension(app_state): Extension<Arc<AppState>>,
    Extension(user_claims): Extension<AuthMiddleware>,
    Path(id): Path<Uuid>,
) -> Result<impl IntoResponse, HttpError> {
    ensure_can_access_satker(&user_claims.user_claims, id)?;

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
    ensure_can_access_satker(&user_claims.user_claims, id)?;

    let work_start = parse_time_field(&payload.work_start, "work_start")?;
    let work_end = parse_time_field(&payload.work_end, "work_end")?;
    let half_day_end = parse_optional_time_field(payload.half_day_end.as_deref(), "half_day_end")?;

    if work_end <= work_start {
        return Err(HttpError::bad_request("work_end: harus > work_start"));
    }
    if let Some(h) = half_day_end {
        if h <= work_start {
            return Err(HttpError::bad_request("half_day_end: harus > work_start"));
        }
        if h > work_end {
            return Err(HttpError::bad_request(
                "half_day_end: tidak boleh > work_end",
            ));
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
    ensure_can_access_satker(&user_claims.user_claims, id)?;

    let date = NaiveDate::parse_from_str(&effective_from, "%Y-%m-%d")
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
        return Err(HttpError::unauthorized(
            "hanya boleh menghapus work pattern yang paling lama (berdasarkan created_at)",
        ));
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
