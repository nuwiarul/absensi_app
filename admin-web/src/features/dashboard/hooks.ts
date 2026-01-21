import { useQuery } from "@tanstack/react-query"
import { fetchAttendanceCountsBySatker } from "./api"

export function useAttendanceCountsBySatker(date: string) {
  return useQuery({
    queryKey: ["dashboard", "attendance-counts", date],
    queryFn: () => fetchAttendanceCountsBySatker(date),
    staleTime: 10_000,
  })
}
