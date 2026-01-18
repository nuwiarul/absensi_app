import type { ApiResponse } from "@/lib/types"

export type SatkerWorkPattern = {
  satker_id: string
  effective_from: string // YYYY-MM-DD
  mon_work: boolean
  tue_work: boolean
  wed_work: boolean
  thu_work: boolean
  fri_work: boolean
  sat_work: boolean
  sun_work: boolean
  work_start: string // "HH:MM:SS" from backend
  work_end: string
  half_day_end: string | null
}

export type UpsertWorkPatternReq = {
  effective_from: string
  mon_work: boolean
  tue_work: boolean
  wed_work: boolean
  thu_work: boolean
  fri_work: boolean
  sat_work: boolean
  sun_work: boolean
  work_start: string
  work_end: string
  half_day_end?: string | null
}

export type WorkPatternsResp = ApiResponse<SatkerWorkPattern[]>
export type UpsertWorkPatternResp = ApiResponse<SatkerWorkPattern>
