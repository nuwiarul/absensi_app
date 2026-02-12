use crate::auth::rbac::UserRole;
use crate::constants::{HolidayKind, HolidayScope};
use crate::error::HttpError;
use chrono::NaiveTime;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HolidayScopeAccess {
    National,
    Satker(Uuid),
}

/// Centralizes holiday scope authorization for SUPERADMIN, SATKER_ADMIN, and SATKER_HEAD roles.
pub fn authorize_holiday_scope_access(
    role: UserRole,
    user_satker_id: Uuid,
    scope: HolidayScope,
    satker_id: Option<Uuid>,
) -> Result<HolidayScopeAccess, HttpError> {
    match scope {
        HolidayScope::National => {
            if role != UserRole::Superadmin {
                return Err(HttpError::unauthorized("forbidden".to_string()));
            }
            if satker_id.is_some() {
                return Err(HttpError::bad_request(
                    "satker_id: harus null untuk scope NATIONAL".to_string(),
                ));
            }
            Ok(HolidayScopeAccess::National)
        }
        HolidayScope::Satker => {
            let sid = satker_id.ok_or_else(|| {
                HttpError::bad_request("satker_id: wajib untuk scope SATKER".to_string())
            })?;

            let allowed = if role == UserRole::Superadmin {
                true
            } else {
                matches!(role, UserRole::SatkerAdmin | UserRole::SatkerHead)
                    && user_satker_id == sid
            };

            if !allowed {
                return Err(HttpError::unauthorized("forbidden".to_string()));
            }

            Ok(HolidayScopeAccess::Satker(sid))
        }
    }
}

fn parse_half_day_end(time: Option<String>) -> Result<Option<NaiveTime>, HttpError> {
    match time {
        None => Ok(None),
        Some(value) => {
            let parsed = NaiveTime::parse_from_str(&value, "%H:%M")
                .or_else(|_| NaiveTime::parse_from_str(&value, "%H:%M:%S"))
                .map_err(|_| {
                    HttpError::bad_request(format!(
                        "half_day_end: format jam tidak valid ({})",
                        value
                    ))
                })?;
            Ok(Some(parsed))
        }
    }
}

/// Normalizes optional kind/time payload from handlers to guard half-day rules.
pub fn normalize_holiday_kind_and_half_day(
    kind: Option<HolidayKind>,
    half_day_end: Option<String>,
) -> Result<(HolidayKind, Option<NaiveTime>), HttpError> {
    let kind = kind.unwrap_or(HolidayKind::Holiday);
    let half_day_end = parse_half_day_end(half_day_end)?;

    if kind == HolidayKind::Holiday && half_day_end.is_some() {
        return Err(HttpError::bad_request(
            "half_day_end: hanya boleh diisi jika kind=HALF_DAY".to_string(),
        ));
    }

    Ok((kind, half_day_end))
}
