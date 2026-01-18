import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getTimezone, updateTimezone } from "./api"
import type { UpdateTimezoneReq } from "./types"

export function useTimezoneQuery() {
  return useQuery({
    queryKey: ["settings", "timezone"],
    queryFn: getTimezone,
    staleTime: 60_000,
  })
}

export function useUpdateTimezoneMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateTimezoneReq) => updateTimezone(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "timezone"] }),
  })
}
