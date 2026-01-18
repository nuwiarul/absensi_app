import { useMutation } from "@tanstack/react-query"
import { generateCalendar } from "./api"

export function useGenerateCalendar() {
  return useMutation({
    mutationFn: (args: { satkerId: string; from: string; to: string }) =>
      generateCalendar(args.satkerId, args.from, args.to),
  })
}
