import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { listWorkPatterns, upsertWorkPattern, deleteWorkPattern } from "./api"
import type { UpsertWorkPatternReq } from "./types"

export function useWorkPatterns(satkerId: string | null) {
  return useQuery({
    queryKey: ["work-patterns", satkerId],
    queryFn: () => listWorkPatterns(satkerId!),
    enabled: !!satkerId,
  })
}

export function useUpsertWorkPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { satkerId: string; body: UpsertWorkPatternReq }) => upsertWorkPattern(args.satkerId, args.body),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["work-patterns", vars.satkerId] })
    },
  })
}

export function useDeleteWorkPattern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { satkerId: string; effectiveFrom: string }) => deleteWorkPattern(args.satkerId, args.effectiveFrom),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["work-patterns", vars.satkerId] })
    },
  })
}
