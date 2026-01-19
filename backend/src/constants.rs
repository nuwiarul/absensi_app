use std::str::FromStr;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

pub const SUPERUSER_SATKER_ID: Uuid = Uuid::from_bytes([
    0x11, 0x11, 0x11, 0x11,
    0x11, 0x11,
    0x11, 0x11,
    0x11, 0x11,
    0x11, 0x11, 0x11, 0x11, 0x11, 0x11
]);
pub const SUPERUSER_USER_ID: Uuid = Uuid::from_bytes([
    0x11, 0x11, 0x11, 0x11,
    0x11, 0x11,
    0x11, 0x11,
    0x11, 0x11,
    0x11, 0x11, 0x11, 0x11, 0x11, 0x11
]);

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type, Hash)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "leave_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LeaveType {
    Ijin,
    Sakit,
    Cuti,
    DinasLuar,
}

impl FromStr for LeaveType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "IJIN" => Ok(LeaveType::Ijin),
            "SAKIT" => Ok(LeaveType::Sakit),
            "CUTI" => Ok(LeaveType::Cuti),
            "DINAS_LUAR" => Ok(LeaveType::DinasLuar),
            _ => Err(format!("bukan tipe ijin yang valid {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "leave_status", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LeaveStatus  {
    Draft,
    Submitted,
    Approved,
    Rejected,
    Cancelled,
}

impl FromStr for LeaveStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "DRAFT" => Ok(LeaveStatus::Draft),
            "SUBMITTED" => Ok(LeaveStatus::Submitted),
            "APPROVED" => Ok(LeaveStatus::Approved),
            "REJECTED" => Ok(LeaveStatus::Rejected),
            "CANCELLED" => Ok(LeaveStatus::Cancelled),
            _ => Err(format!("bukan status ijin yang valid {}", s)),
        }
    }
}

#[derive(Debug, Serialize, Deserialize, PartialEq, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AttendanceStatus {
    Open,
    Closed,
    Invalid,
}

impl FromStr for AttendanceStatus {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "OPEN" => Ok(AttendanceStatus::Open),
            "CLOSED" => Ok(AttendanceStatus::Closed),
            "INVALID" => Ok(AttendanceStatus::Invalid),
            _ => Err(format!("bukan attendance status {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "attendance_event_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AttendanceEventType  {
    CheckIn,
    CheckOut,
}

impl FromStr for AttendanceEventType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "CHECK_IN" => Ok(AttendanceEventType::CheckIn),
            "CHECK_OUT" => Ok(AttendanceEventType::CheckOut),
            _ => Err(format!("bukan attendance event type yang valid {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "schedule_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ScheduleType {
    Regular,
    Shift,
    OnCall,
    Special,
}

impl FromStr for ScheduleType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "REGULAR" => Ok(ScheduleType::Regular),
            "SHIFT" => Ok(ScheduleType::Shift),
            "ON_CALL" => Ok(ScheduleType::OnCall),
            "SPECIAL" => Ok(ScheduleType::Special),
            _ => Err(format!("bukan schedule event type yang valid {}", s)),
        }
    }
}

#[derive(Debug, Copy, Serialize,  Deserialize, Clone, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "attendance_leave_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum AttendanceLeaveType {
    Normal,
    DinasLuar,
    Wfa,
    Wfh,
    Ijin,
    Sakit,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "holiday_scope", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HolidayScope {
    National,
    Satker,
}

impl FromStr for HolidayScope {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "NATIONAL" => Ok(HolidayScope::National),
            "SATKER" => Ok(HolidayScope::Satker),
            _ => Err(format!("bukan holiday scope yang valid {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "holiday_kind", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum HolidayKind {
    Holiday,
    HalfDay,
}

impl FromStr for HolidayKind {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "HOLIDAY" => Ok(HolidayKind::Holiday),
            "HALF_DAY" => Ok(HolidayKind::HalfDay),
            _ => Err(format!("bukan holiday kind yang valid {}", s)),
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, sqlx::Type)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
#[sqlx(type_name = "calendar_day_type", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum CalendarDayType {
    Workday,
    Holiday,
    HalfDay,
}

impl FromStr for CalendarDayType {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_uppercase().as_str() {
            "WORKDAY" => Ok(CalendarDayType::Workday),
            "HOLIDAY" => Ok(CalendarDayType::Holiday),
            "HALF_DAY" => Ok(CalendarDayType::HalfDay),
            _ => Err(format!("bukan calendar day type yang valid {}", s)),
        }
    }
}

