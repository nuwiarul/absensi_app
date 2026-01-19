import { useQuery } from "@tanstack/react-query"
import type { AttendanceRekapQuery } from "./types"
import { fetchAttendanceRecap } from "./api"

export function useAttendanceRecap(q: AttendanceRekapQuery, enabled: boolean) {
  return useQuery({
    queryKey: ["attendance-recap", q],
    queryFn: () => fetchAttendanceRecap(q),
    enabled,
  })
}
