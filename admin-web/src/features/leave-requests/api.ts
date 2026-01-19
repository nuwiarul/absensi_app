import { http } from "@/lib/http"
import type { LeaveRequestsQuery, LeaveRequestsResp } from "./types"

// GET /leave-requests?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function listLeaveRequests(params: LeaveRequestsQuery): Promise<LeaveRequestsResp> {
  const { data } = await http.get<LeaveRequestsResp>("/leave-requests", { params })
  return data
}
