use crate::constants::HolidayScope;
use crate::models::{Holiday, SatkerWorkPattern};
use chrono::{NaiveDate, Weekday};
use std::collections::HashMap;

/// Keeps the most specific holiday (SATKER overrides NATIONAL) for each date.
pub fn build_holiday_override_map(holidays: Vec<Holiday>) -> HashMap<NaiveDate, Holiday> {
    let mut map: HashMap<NaiveDate, Holiday> = HashMap::new();
    for holiday in holidays {
        let replace = match map.get(&holiday.holiday_date) {
            Some(existing) => {
                existing.scope == HolidayScope::National && holiday.scope == HolidayScope::Satker
            }
            None => true,
        };
        if replace {
            map.insert(holiday.holiday_date, holiday);
        }
    }
    map
}

/// Shared helper to check whether a weekday is marked as a workday for a pattern.
pub fn weekday_is_work(pattern: &SatkerWorkPattern, weekday: Weekday) -> bool {
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
