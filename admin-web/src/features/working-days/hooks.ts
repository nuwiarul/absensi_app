import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { deleteWorkingDay, listWorkingDays, upsertWorkingDay } from "./api"
import type { UpsertWorkingDayReq } from "./types"

export function useWorkingDays(params: { satkerId?: string; from?: string; to?: string }, enabled = true) {
  return useQuery({
    queryKey: ["working-days", params.satkerId, params.from, params.to],
    queryFn: () =>
      listWorkingDays({ satkerId: params.satkerId!, from: params.from!, to: params.to! }),
    enabled: enabled && Boolean(params.satkerId && params.from && params.to),
  })
}

export function useUpsertWorkingDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { satkerId: string; workDate: string; body: UpsertWorkingDayReq }) =>
      upsertWorkingDay(p),
    onSuccess: (_data, vars) => {
      // refresh any range for this satker
      qc.invalidateQueries({ queryKey: ["working-days", vars.satkerId] })
    },
  })
}

export function useDeleteWorkingDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: { satkerId: string; workDate: string }) => deleteWorkingDay(p),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["working-days", vars.satkerId] })
    },
  })
}
