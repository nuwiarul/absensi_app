import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useToastMutation } from "@/hooks/use-toast-mutation"
import {
  createTukinPolicy,
  fetchLeaveRules,
  fetchTukinCalculations,
  fetchTukinPolicies,
  generateTukinCalculations,
  saveLeaveRules,
  updateTukinPolicy,
    deleteTukinPolicy
} from "./api"
import type {
  CreateTukinPolicyReq,
  SaveLeaveRulesReq,
  TukinCalculationsResp,
  TukinPolicy,
  UpdateTukinPolicyReq,
} from "./types"



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
  return useToastMutation({
    mutationFn: (payload: CreateTukinPolicyReq) => createTukinPolicy(payload),
    successMessage: "Policy Tukin berhasil dibuat",
    invalidateQueries: [["tukin", "policies"]],
  })
}

export function useUpdateTukinPolicy() {
  return useToastMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateTukinPolicyReq }) =>
      updateTukinPolicy(id, body),
    successMessage: "Policy Tukin berhasil diupdate",
    invalidateQueries: [["tukin", "policies"]],
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
  return useToastMutation({
    mutationFn: (payload: SaveLeaveRulesReq) => saveLeaveRules(policyId, payload),
    successMessage: "Leave rules berhasil disimpan",
    invalidateQueries: [tukinKeys.leaveRules(policyId)],
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
  return useToastMutation<TukinCalculationsResp["data"], unknown, { month: string; satkerId?: string; userId?: string; force?: boolean }>({
    mutationFn: (params: { month: string; satkerId?: string; userId?: string; force?: boolean }) =>
      generateTukinCalculations({
        month: params.month,
        satker_id: params.satkerId,
        user_id: params.userId,
        force: params.force,
      }),
    successMessage: "Tukin cache berhasil digenerate",
    invalidateQueries: (vars) => [
      ["tukin", "calculations", vars.month, vars.satkerId ?? "ALL", vars.userId ?? "ALL"],
    ],
  })
}

export function useDeleteTukinPolicy() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteTukinPolicy(id),

    // ✅ optimistic remove: semua cache tukin policies langsung diupdate
    onMutate: async (id: string) => {
      await qc.cancelQueries({
        predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === "tukin" &&
            q.queryKey[1] === "policies",
      })

      const prev = qc.getQueriesData({
        predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === "tukin" &&
            q.queryKey[1] === "policies",
      })

      qc.setQueriesData(
          {
            predicate: (q) =>
                Array.isArray(q.queryKey) &&
                q.queryKey[0] === "tukin" &&
                q.queryKey[1] === "policies",
          },
          (old: unknown) => {
            if (!Array.isArray(old)) return old
            return (old as TukinPolicy[]).filter((p) => p.id !== id)
          }
      )

      return { prev }
    },

    onError: (_err, _id, ctx) => {
      // rollback kalau gagal
      if (ctx?.prev) {
        for (const [key, data] of ctx.prev) qc.setQueryData(key, data)
      }
    },

    onSuccess: async () => {
      toast.success("Policy berhasil dihapus")

      // ✅ paksa refresh dari server (bukan cuma invalidate)
      await qc.refetchQueries({
        predicate: (q) =>
            Array.isArray(q.queryKey) &&
            q.queryKey[0] === "tukin" &&
            q.queryKey[1] === "policies",
      })
    },
  })
}


/*export function useDeleteTukinPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => deleteTukinPolicy(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tukinPolicies"] })
    },
  })
}*/
