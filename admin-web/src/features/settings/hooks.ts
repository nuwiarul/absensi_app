import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { getTimezone, updateTimezone } from "./api"
import type {TimezoneResp, UpdateTimezoneReq} from "./types"

/*export function useTimezoneQuery() {
  return useQuery({
    queryKey: ["settings", "timezone"],
    queryFn: getTimezone,
    staleTime: 60_000,
  })
}*/

export function useTimezoneQuery() {
  return useQuery({
    queryKey: ["settings", "timezone"],
    queryFn: getTimezone,
    staleTime: 60_000,
    // Extract the nested data automatically
    select: (response: TimezoneResp) => response.data
  })
}

export function useUpdateTimezoneMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpdateTimezoneReq) => updateTimezone(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings", "timezone"] }),
  })
}
