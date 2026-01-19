export type LeaveStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED" | "CANCELLED"

export type LeaveType = "IJIN" | "SAKIT" | "CUTI" | "DINAS_LUAR"

export type LeaveRequestDto = {
  id: string
  satker_name: string
  satker_id: string
  satker_code: string

  user_full_name: string
  user_id: string
  user_nrp: string

  tipe: LeaveType
  start_date: string // YYYY-MM-DD
  end_date: string // YYYY-MM-DD
  reason?: string | null
  status: LeaveStatus

  // approval
  decision_note?: string | null
  approver_full_name?: string | null
}

export type LeaveRequestsResp = {
  status: string
  data: LeaveRequestDto[]
}

// Pending list is a slimmer DTO from backend
export type PendingLeaveRequestDto = {
  id: string
  satker_id: string
  satker_code: string
  satker_name: string
  user_id: string
  requester_name: string
  requester_nrp: string
  tipe: LeaveType
  start_date: string
  end_date: string
  reason?: string | null
  status: LeaveStatus
  submitted_at?: string | null
  created_at?: string | null
}

export type PendingLeaveRequestsResp = {
  status: string
  data: PendingLeaveRequestDto[]
}

export type DecisionLeaveReq = {
  note?: string | null
}

export type LeaveRequestsQuery = {
  from: string
  to: string
  satker_id?: string
}

export type PendingLeaveRequestsQuery = {
  satker_id?: string
}
