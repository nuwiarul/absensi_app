import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import {
  createTukinPolicy,
  fetchLeaveRules,
  fetchTukinCalculations,
  fetchTukinPolicies,
  generateTukinCalculations,
  saveLeaveRules,
  updateTukinPolicy,
} from "./api"
import type { CreateTukinPolicyReq, SaveLeaveRulesReq, UpdateTukinPolicyReq } from "./types"

export const tukinKeys = {
  policies: (satkerId?: string) => ["tukin", "policies", satkerId ?? "ALL"] as const,
  calculations: (q: { month: string; satkerId?: string; userId?: string }) =>
    ["tukin", "calculations", q.month, q.satkerId ?? "ALL", q.userId ?? "ALL"] as const,
  leaveRules: (policyId: string) => ["tukin", "leave-rules", policyId] as const,
}

export function useTukinPolicies(satkerId?: string) {
  return useQuery({
    queryKey: tukinKeys.policies(satkerId),
    queryFn: () => fetchTukinPolicies(satkerId ? { satker_id: satkerId } : undefined),
  })
}

export function useCreateTukinPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTukinPolicyReq) => createTukinPolicy(payload),
    onSuccess: () => {
      toast.success("Policy Tukin berhasil dibuat")
      qc.invalidateQueries({ queryKey: ["tukin", "policies"] })
    },
  })
}

export function useUpdateTukinPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTukinPolicyReq }) => updateTukinPolicy(id, body),
    onSuccess: () => {
      toast.success("Policy Tukin berhasil diupdate")
      qc.invalidateQueries({ queryKey: ["tukin", "policies"] })
    },
  })
}

export function useLeaveRules(policyId?: string) {
  return useQuery({
    queryKey: tukinKeys.leaveRules(policyId ?? "NONE"),
    queryFn: () => fetchLeaveRules(policyId!),
    enabled: !!policyId,
  })
}

export function useSaveLeaveRules(policyId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: SaveLeaveRulesReq) => saveLeaveRules(policyId, payload),
    onSuccess: () => {
      toast.success("Leave rules berhasil disimpan")
      qc.invalidateQueries({ queryKey: tukinKeys.leaveRules(policyId) })
    },
  })
}

export function useTukinCalculations(args: {
  month: string
  satkerId?: string
  userId?: string
  enabled?: boolean
}) {
  const { month, satkerId, userId, enabled = true } = args
  return useQuery({
    queryKey: tukinKeys.calculations({ month, satkerId, userId }),
    queryFn: () => fetchTukinCalculations({ month, satker_id: satkerId, user_id: userId }),
    enabled,
  })
}

export function useGenerateTukin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { month: string; satkerId?: string; userId?: string; force?: boolean }) =>
      generateTukinCalculations({
        month: params.month,
        satker_id: params.satkerId,
        user_id: params.userId,
        force: params.force,
      }),
    onSuccess: (_rows, vars) => {
      toast.success("Tukin cache berhasil digenerate")
      qc.invalidateQueries({
        queryKey: ["tukin", "calculations", vars.month, vars.satkerId ?? "ALL", vars.userId ?? "ALL"],
      })
    },
  })
}
