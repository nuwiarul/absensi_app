export type AttendanceLeaveType =
    | "NORMAL"
    | "DINAS_LUAR"
    | "WFA"
    | "WFH"
    | "IJIN"
    | "SAKIT"
    // NOTE: Leave Request (ijin/cuti) bisa muncul di rekap meski tidak ada attendance.
    // Backend attendance_leave_type belum tentu mengirim CUTI, tapi untuk rekap kita support.
    | "CUTI"

export type AttendanceRekapRow = {
  session_id: string
  work_date: string // YYYY-MM-DD
  user_id: string
  full_name: string
  nrp: string
  satker_name: string
  satker_code: string

  check_in_at?: string // RFC3339 (UTC)
  check_out_at?: string // RFC3339 (UTC)

  check_in_geofence_id?: string
  check_out_geofence_id?: string

  check_in_distance_to_fence_m?: number
  check_out_distance_to_fence_m?: number

  check_in_geofence_name?: string
  check_out_geofence_name?: string

  check_in_latitude?: number
  check_in_longitute?: number
  check_out_latitude?: number
  check_out_longitute?: number

  check_in_selfie_object_key?: string
  check_out_selfie_object_key?: string

  check_in_accuracy_meters?: number
  check_out_accuracy_meters?: number

  check_in_attendance_leave_type?: AttendanceLeaveType
  check_out_attendance_leave_type?: AttendanceLeaveType
  check_in_attendance_leave_notes?: string
  check_out_attendance_leave_notes?: string

  check_in_device_id?: string
  check_out_device_id?: string
  check_in_device_model?: string
  check_out_device_model?: string
  check_in_device_name?: string
  check_out_device_name?: string

  // Manual correction oleh SUPERADMIN
  is_manual?: boolean
  manual_note?: string
  manual_updated_at?: string
}

export type AttendanceRekapQuery = {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  user_id?: string
}

export type AttendanceRekapResp = {
  status: string
  data: AttendanceRekapRow[]
}
