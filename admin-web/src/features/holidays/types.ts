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
