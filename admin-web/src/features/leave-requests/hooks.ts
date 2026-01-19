import { useQuery } from "@tanstack/react-query"
import { listLeaveRequests } from "./api"

export function useLeaveRequests(params: { from?: string; to?: string }, enabled?: boolean) {
  return useQuery({
    queryKey: ["leave-requests", params.from, params.to],
    queryFn: () => listLeaveRequests({ from: params.from!, to: params.to! }),
    enabled: Boolean(enabled && params.from && params.to),
  })
}
