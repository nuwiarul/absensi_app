import { useQuery } from "@tanstack/react-query"
import { useToastMutation } from "@/hooks/use-toast-mutation"
import {
  approveLeaveRequest,
  quickApproveLeave,
  listDecidedLeaveRequests,
  listLeaveRequests,
  listPendingLeaveRequests,
  rejectLeaveRequest,
} from "./api"
import type { DecisionLeaveReq, QuickApproveLeaveReq } from "./types"

export const leaveRequestsKeys = {
  all: (from?: string, to?: string, satkerId?: string) => ["leave-requests", from, to, satkerId] as const,
  pending: (satkerId?: string) => ["leave-requests", "pending", satkerId] as const,
  decided: (from?: string, to?: string, satkerId?: string) => ["leave-requests", "decided", from, to, satkerId] as const,
}

export function useLeaveRequests(params: { from?: string; to?: string; satkerId?: string }, enabled?: boolean) {
  return useQuery({
    queryKey: leaveRequestsKeys.all(params.from, params.to, params.satkerId),
    queryFn: () => listLeaveRequests({ from: params.from!, to: params.to!, satker_id: params.satkerId }),
    enabled: Boolean(enabled && params.from && params.to),
  })
}

export function usePendingLeaveRequests(params: { satkerId?: string }, enabled?: boolean) {
  return useQuery({
    queryKey: leaveRequestsKeys.pending(params.satkerId),
    queryFn: () => listPendingLeaveRequests({ satker_id: params.satkerId }),
    enabled: Boolean(enabled),
    refetchInterval: 30_000,
  })
}

export function useDecidedLeaveRequests(params: { from?: string; to?: string; satkerId?: string }, enabled?: boolean) {
  return useQuery({
    queryKey: leaveRequestsKeys.decided(params.from, params.to, params.satkerId),
    queryFn: () => listDecidedLeaveRequests({ from: params.from!, to: params.to!, satker_id: params.satkerId }),
    enabled: Boolean(enabled && params.from && params.to),
  })
}

export function useApproveLeaveRequest() {
  return useToastMutation({
    mutationFn: ({ id, body }: { id: string; body: DecisionLeaveReq }) => approveLeaveRequest(id, body),
    successMessage: "Leave request berhasil di-approve",
    invalidateQueries: [
      ["leave-requests", "pending"],
      ["leave-requests"],
    ],
  })
}

export function useRejectLeaveRequest() {
  return useToastMutation({
    mutationFn: ({ id, body }: { id: string; body: DecisionLeaveReq }) => rejectLeaveRequest(id, body),
    successMessage: "Leave request berhasil di-reject",
    invalidateQueries: [
      ["leave-requests", "pending"],
      ["leave-requests"],
    ],
  })
}

export function useQuickApproveLeave() {
  return useToastMutation({
    mutationFn: (body: QuickApproveLeaveReq) => quickApproveLeave(body),
    successMessage: "Leave berhasil di-approve (auto)",
    invalidateQueries: [
      ["leave-requests"],
      ["leave-requests", "decided"],
      ["leave-requests", "pending"],
      ["attendance"],
      ["tukin"],
    ],
  })
}
