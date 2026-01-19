export type ApiResponse<T> = {
  status: string
  data: T
}

export type ScheduleType = "REGULAR" | "SHIFT" | "ON_CALL" | "SPECIAL"

export type DutyScheduleDto = {
  id: string
  satker_id: string
  satker_code: string
  satker_name: string

  user_id: string
  user_full_name: string
  user_nrp: string
  user_phone: string | null

  start_at: string // ISO datetime
  end_at: string // ISO datetime

  schedule_type: ScheduleType
  title: string | null
  note: string | null

  created_by: string | null
  created_at: string
  updated_at: string
}

export type DutySchedulesResp = ApiResponse<DutyScheduleDto[]>

export type ListDutySchedulesQuery = {
  from: string // ISO datetime
  to: string // ISO datetime (exclusive)
  satker_id?: string
  user_id?: string
}

export type CreateDutyScheduleReq = {
  user_id: string
  start_at: string // ISO datetime
  end_at: string // ISO datetime
  schedule_type?: ScheduleType
  title?: string
  note?: string
}

export type UpdateDutyScheduleReq = {
  start_at?: string
  end_at?: string
  schedule_type?: ScheduleType
  title?: string | null
  note?: string | null
}
