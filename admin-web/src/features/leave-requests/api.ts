import { http } from "@/lib/http"
import type {
  DecisionLeaveReq,
  LeaveRequestsQuery,
  LeaveRequestsResp,
  PendingLeaveRequestsQuery,
  PendingLeaveRequestsResp,
  QuickApproveLeaveReq,
  QuickApproveLeaveResp,
} from "./types"


// GET /leave-requests?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function listLeaveRequests(params: LeaveRequestsQuery): Promise<LeaveRequestsResp> {
  const { data } = await http.get<LeaveRequestsResp>("/leave-requests", { params })
  return data
}

// GET /leave-requests/pending?satker_id=...
export async function listPendingLeaveRequests(params?: PendingLeaveRequestsQuery): Promise<PendingLeaveRequestsResp> {
  const { data } = await http.get<PendingLeaveRequestsResp>("/leave-requests/pending", { params })
  return data
}

// GET /leave-requests/decided?from&to
export async function listDecidedLeaveRequests(params: LeaveRequestsQuery): Promise<LeaveRequestsResp> {
  const { data } = await http.get<LeaveRequestsResp>("/leave-requests/decided", { params })
  return data
}

// POST /leave-requests/{id}/approve
export async function approveLeaveRequest(id: string, body: DecisionLeaveReq): Promise<{ status: string; data: string }> {
  const { data } = await http.post<{ status: string; data: string }>(`/leave-requests/${id}/approve`, body)
  return data
}

// POST /leave-requests/{id}/reject
export async function rejectLeaveRequest(id: string, body: DecisionLeaveReq): Promise<{ status: string; data: string }> {
  const { data } = await http.post<{ status: string; data: string }>(`/leave-requests/${id}/reject`, body)
  return data
}

// POST /leave-requests/quick-approve
// Used by AttendanceManagePage for Tukin flow: create leave_request and approve immediately.
export async function quickApproveLeave(body: QuickApproveLeaveReq): Promise<QuickApproveLeaveResp> {
  const { data } = await http.post<QuickApproveLeaveResp>("/leave-requests/quick-approve", body)
  return data
}


/*
import { http } from "@/lib/http"
import type {
  DecisionLeaveReq,
  LeaveRequestsQuery,
  LeaveRequestsResp,
  PendingLeaveRequestsQuery,
  PendingLeaveRequestsResp,
  QuickApproveLeaveReq,
  QuickApproveLeaveResp,
} from "./types"


// GET /leave-requests?from=YYYY-MM-DD&to=YYYY-MM-DD
export async function listLeaveRequests(params: LeaveRequestsQuery): Promise<LeaveRequestsResp> {
  const { data } = await http.get<LeaveRequestsResp>("/leave-requests", { params })
  return data
}

// GET /leave-requests/pending?satker_id=...
export async function listPendingLeaveRequests(params?: PendingLeaveRequestsQuery): Promise<PendingLeaveRequestsResp> {
  const { data } = await http.get<PendingLeaveRequestsResp>("/leave-requests/pending", { params })
  return data
}

// GET /leave-requests/decided?from&to
export async function listDecidedLeaveRequests(params: LeaveRequestsQuery): Promise<LeaveRequestsResp> {
  const { data } = await http.get<LeaveRequestsResp>("/leave-requests/decided", { params })
  return data
}

// POST /leave-requests/{id}/approve
export async function approveLeaveRequest(id: string, body: DecisionLeaveReq): Promise<{ status: string; data: string }> {
  const { data } = await http.post<{ status: string; data: string }>(`/leave-requests/${id}/approve`, body)
  return data
}

// POST /leave-requests/{id}/reject
export async function rejectLeaveRequest(id: string, body: DecisionLeaveReq): Promise<{ status: string; data: string }> {
  const { data } = await http.post<{ status: string; data: string }>(`/leave-requests/${id}/reject`, body)
  return data
}

// POST /leave-requests/quick-approve
// Used by AttendanceManagePage for Tukin flow: create leave_request and approve immediately.
export async function quickApproveLeave(body: QuickApproveLeaveReq): Promise<QuickApproveLeaveResp> {
  const { data } = await http.post<QuickApproveLeaveResp>("/leave-requests/quick-approve", body)
  return data
}
*/
