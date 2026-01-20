import type { LeaveType } from "@/features/leave-requests/types"

export type PolicyScope = "GLOBAL" | "SATKER"

export type TukinPolicy = {
  id: string
  scope: PolicyScope
  satker_id?: string | null
  satker_code?: string | null
  satker_name?: string | null

  effective_from: string // YYYY-MM-DD
  effective_to?: string | null

  missing_checkout_penalty_pct: number
  late_tolerance_minutes: number
  late_penalty_per_minute_pct: number
  max_daily_penalty_pct: number
  out_of_geofence_penalty_pct: number

  created_at?: string | null
  updated_at?: string | null
}

export type TukinPolicyResp = {
  status: string
  data: TukinPolicy[]
}

export type CreateTukinPolicyReq = {
  scope: PolicyScope
  satker_id?: string | null
  effective_from: string
  effective_to?: string | null

  missing_checkout_penalty_pct: number
  late_tolerance_minutes: number
  late_penalty_per_minute_pct: number
  max_daily_penalty_pct: number
  out_of_geofence_penalty_pct: number
}

export type UpdateTukinPolicyReq = {
  effective_from?: string
  effective_to?: string | null

  missing_checkout_penalty_pct?: number
  late_tolerance_minutes?: number
  late_penalty_per_minute_pct?: number
  max_daily_penalty_pct?: number
  out_of_geofence_penalty_pct?: number
}

export type LeaveRule = {
  leave_type: LeaveType
  credit: number,
  counts_as_present: boolean
}

export type LeaveRulesResp = {
  status: string
  data: LeaveRule[]
}

export type SaveLeaveRulesReq = {
  rules: LeaveRule[]
}

export type TukinCalculationRow = {
  month: string // YYYY-MM
  satker_id: string
  satker_code?: string | null
  satker_name?: string | null

  user_id: string
  user_full_name: string
  user_nrp: string

  rank_code?: string | null
  rank_name?: string | null

  base_tukin: number
  expected_units: number
  earned_credit: number
  attendance_ratio: number
  final_tukin: number

  // JSON dari backend (berisi days breakdown, dll)
  breakdown?: any
  updated_at?: string
}

export type TukinCalculationsResp = {
  status: string
  data: TukinCalculationRow[]
}
