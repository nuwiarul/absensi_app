import type { ApiResponse } from "@/lib/types"

export type GenerateCalendarResp = ApiResponse<{ days_generated: number }>

export type CalendarDayType = "WORKDAY" | "HALF_DAY" | "HOLIDAY"

export type CalendarDay = {
  satker_id: string
  work_date: string
  day_type: CalendarDayType
  expected_start: string | null
  expected_end: string | null
  note: string | null
}

export type ListCalendarResp = ApiResponse<CalendarDay[]>
