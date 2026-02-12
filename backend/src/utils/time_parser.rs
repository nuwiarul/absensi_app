use crate::error::HttpError;
use chrono::NaiveTime;

fn parse_naive_time(value: &str, field: &str) -> Result<NaiveTime, HttpError> {
    NaiveTime::parse_from_str(value, "%H:%M")
        .or_else(|_| NaiveTime::parse_from_str(value, "%H:%M:%S"))
        .map_err(|_| {
            HttpError::bad_request(format!("{}: format jam tidak valid ({})", field, value))
        })
}

/// Parses a required time field (HH:MM or HH:MM:SS).
pub fn parse_time_field(value: &str, field: &str) -> Result<NaiveTime, HttpError> {
    parse_naive_time(value, field)
}

/// Parses an optional time field; returns None when the input is missing.
pub fn parse_optional_time_field(
    value: Option<&str>,
    field: &str,
) -> Result<Option<NaiveTime>, HttpError> {
    match value {
        Some(v) => Ok(Some(parse_naive_time(v, field)?)),
        None => Ok(None),
    }
}
