export type SatkerAttendanceCountRow = {
  satker_id: string
  satker_code: string
  satker_name: string
  checked_in_count: number
  total_users: number
  present_pct: number
}

export type AttendanceCountsResp = {
  status: string
  data: SatkerAttendanceCountRow[]
}
