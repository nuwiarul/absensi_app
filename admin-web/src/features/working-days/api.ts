import { http } from "@/lib/http"
import type { ApiResponse, UpsertWorkingDayReq, WorkingDay } from "./types"

export async function listWorkingDays(params: {
  satkerId: string
  from: string
  to: string
}): Promise<WorkingDay[]> {
  const res = await http.get<ApiResponse<WorkingDay[]>>("/working-days", {
    params: { satker_id: params.satkerId, from: params.from, to: params.to },
  })
  return res.data.data ?? []
}

export async function upsertWorkingDay(params: {
  satkerId: string
  workDate: string
  body: UpsertWorkingDayReq
}): Promise<WorkingDay> {
  const res = await http.put<ApiResponse<WorkingDay>>(
    `/working-days/${params.satkerId}/${params.workDate}`,
    {
      ...params.body,
      // backend expects snake_case
      expected_start: params.body.expected_start ?? undefined,
      expected_end: params.body.expected_end ?? undefined,
    }
  )
  return res.data.data
}

export async function deleteWorkingDay(params: { satkerId: string; workDate: string }): Promise<void> {
  await http.delete(`/working-days/${params.satkerId}/${params.workDate}`)
}