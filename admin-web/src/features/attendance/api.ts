import { http } from "@/lib/http"
import type { AttendanceRekapQuery, AttendanceRekapResp } from "./types"

export type UpsertAttendanceAdminBody = {
  check_in_at: string | null
  check_out_at: string | null
  check_in_geofence_id: string | null
  check_out_geofence_id: string | null
  check_in_leave_type: string | null
  check_out_leave_type: string | null
  check_in_leave_notes: string | null
  check_out_leave_notes: string | null
  device_id: string | null
  device_model: string | null
  client_version: string | null
  manual_note: string
}

export async function fetchAttendanceRecap(q: AttendanceRekapQuery) {
  const { data } = await http.get<AttendanceRekapResp>("/attendance/list", { params: q })
  return data.data
}

export async function fetchSelfieBlob(key: string) {
  const { data } = await http.get<ArrayBuffer>("/files/selfie", {
    params: { key },
    responseType: "arraybuffer",
  })
  return new Blob([data])
}

export async function upsertAttendanceAdmin(userId: string, workDateYmd: string, body: UpsertAttendanceAdminBody) {
  const { data } = await http.put(`/attendance/admin/${userId}/${workDateYmd}`, body)
  return data
}

export async function deleteAttendanceAdmin(userId: string, workDateYmd: string) {
  const { data } = await http.delete(`/attendance/admin/${userId}/${workDateYmd}`)
  return data
}


/*
import { http } from "@/lib/http"
import type { AttendanceRekapQuery, AttendanceRekapResp } from "./types"

export async function fetchAttendanceRecap(q: AttendanceRekapQuery) {
  const { data } = await http.get<AttendanceRekapResp>("/attendance/list", { params: q })
  return data.data
}

export async function fetchSelfieBlob(key: string) {
  const { data } = await http.get<ArrayBuffer>("/files/selfie", {
    params: { key },
    responseType: "arraybuffer",
  })
  return new Blob([data])
}
*/
