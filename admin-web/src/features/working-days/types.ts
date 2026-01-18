export type CalendarDayType = "WORKDAY" | "HOLIDAY" | "HALF_DAY"

export type WorkingDay = {
  satker_id: string
  work_date: string // YYYY-MM-DD
  day_type: CalendarDayType
  expected_start: string | null // HH:MM:SS
  expected_end: string | null // HH:MM:SS
  note: string | null
}

export type ApiResponse<T> = { status: string; data: T }

export type UpsertWorkingDayReq = {
  day_type: CalendarDayType
  expected_start?: string | null // HH:MM or HH:MM:SS
  expected_end?: string | null
  note?: string | null
}
