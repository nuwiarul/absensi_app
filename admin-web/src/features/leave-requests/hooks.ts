import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  approveLeaveRequest,
  listDecidedLeaveRequests,
  listLeaveRequests,
  listPendingLeaveRequests,
  rejectLeaveRequest,
} from "./api"
import type { DecisionLeaveReq } from "./types"

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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DecisionLeaveReq }) => approveLeaveRequest(id, body),
    onSuccess: () => {
      toast.success("Leave request berhasil di-approve")
      qc.invalidateQueries({ queryKey: ["leave-requests", "pending"] })
      qc.invalidateQueries({ queryKey: ["leave-requests"] })
    },
  })
}

export function useRejectLeaveRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: DecisionLeaveReq }) => rejectLeaveRequest(id, body),
    onSuccess: () => {
      toast.success("Leave request berhasil di-reject")
      qc.invalidateQueries({ queryKey: ["leave-requests", "pending"] })
      qc.invalidateQueries({ queryKey: ["leave-requests"] })
    },
  })
}
