import { useMutation, useQuery } from "@tanstack/react-query"
import { generateCalendar, listCalendar } from "./api"

export function useGenerateCalendar() {
  return useMutation({
    mutationFn: (args: { satkerId: string; from: string; to: string }) =>
      generateCalendar(args.satkerId, args.from, args.to),
  })
}

export function useCalendarDays(q: { satkerId: string; from: string; to: string } | null) {
  return useQuery({
    queryKey: ["calendar-days", q],
    queryFn: () => {
      if (!q) throw new Error("no query")
      return listCalendar(q.satkerId, q.from, q.to)
    },
    enabled: !!q,
  })
}
