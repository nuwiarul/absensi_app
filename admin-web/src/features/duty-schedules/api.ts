import { http } from "@/lib/http"
import type {
  CreateDutyScheduleReq,
  DutySchedulesResp,
  ListDutySchedulesQuery,
  UpdateDutyScheduleReq,
} from "./types"

// GET /duty-schedules?from&to&satker_id?&user_id?
export async function listDutySchedules(params: ListDutySchedulesQuery): Promise<DutySchedulesResp> {
  const { data } = await http.get<DutySchedulesResp>("/duty-schedules", { params })
  return data
}

// POST /duty-schedules
export async function createDutySchedule(body: CreateDutyScheduleReq): Promise<{ status: string; data: string }> {
  const { data } = await http.post<{ status: string; data: string }>("/duty-schedules", body)
  return data
}

// PUT /duty-schedules/{id}
export async function updateDutySchedule(
  id: string,
  body: UpdateDutyScheduleReq
): Promise<{ status: string; data: string }> {
  const { data } = await http.put<{ status: string; data: string }>(`/duty-schedules/${id}`, body)
  return data
}

// DELETE /duty-schedules/{id}
export async function deleteDutySchedule(id: string): Promise<{ status: string; data: string }> {
  const { data } = await http.delete<{ status: string; data: string }>(`/duty-schedules/${id}`)
  return data
}
