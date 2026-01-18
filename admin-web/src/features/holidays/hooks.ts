import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { bulkUpsertHolidays, deleteHoliday, listHolidays, upsertHoliday } from "./api"
import type { BulkHolidayReq, ListHolidaysQuery, UpsertHolidayReq } from "./types"

export function useBulkUpsertHolidays() {
  return useMutation({
    mutationFn: (body: BulkHolidayReq) => bulkUpsertHolidays(body),
  })
}

export function useHolidays(q: ListHolidaysQuery | null) {
  return useQuery({
    queryKey: ["holidays", q],
    queryFn: () => {
      if (!q) throw new Error("no query")
      return listHolidays(q)
    },
    enabled: !!q,
  })
}

export function useUpsertHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UpsertHolidayReq) => upsertHoliday(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holidays"] }),
  })
}

export function useDeleteHoliday() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (params: { scope: "NATIONAL" | "SATKER"; satker_id?: string | null; holiday_date: string }) =>
      deleteHoliday(params),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["holidays"] }),
  })
}
