import { http } from "@/lib/http"
import type { AttendanceCountsResp } from "./types"

export async function fetchAttendanceCountsBySatker(date: string): Promise<AttendanceCountsResp> {
  const r = await http.get<AttendanceCountsResp>("/dashboard/attendance-counts", {
    params: { date },
  })
  return r.data
}
