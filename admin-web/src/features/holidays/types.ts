import type { ApiResponse } from "@/lib/types"

export type HolidayScope = "NATIONAL" | "SATKER"
export type HolidayKind = "HOLIDAY" | "HALF_DAY"

export type BulkHolidayItem = {
  holiday_date: string // YYYY-MM-DD
  name: string
  kind?: HolidayKind
  half_day_end?: string | null
}

export type BulkHolidayReq = {
  scope: HolidayScope
  satker_id?: string | null
  items: BulkHolidayItem[]
}

export type BulkHolidayResp = ApiResponse<{ affected_rows: number }>

export type Holiday = {
  id: string
  scope: HolidayScope
  satker_id: string | null
  holiday_date: string // YYYY-MM-DD
  kind: HolidayKind
  name: string
  half_day_end: string | null // "HH:MM:SS" or null
}

export type ListHolidaysQuery = {
  scope?: HolidayScope
  satker_id?: string | null
  from: string
  to: string
}

export type ListHolidaysResp = ApiResponse<Holiday[]>

export type UpsertHolidayReq = {
  scope: HolidayScope
  satker_id?: string | null
  holiday_date: string
  name: string
  kind?: HolidayKind
  half_day_end?: string | null
}

export type UpsertHolidayResp = ApiResponse<string>
