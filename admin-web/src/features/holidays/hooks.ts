import { useMutation } from "@tanstack/react-query"
import { bulkUpsertHolidays } from "./api"
import type { BulkHolidayReq } from "./types"

export function useBulkUpsertHolidays() {
  return useMutation({
    mutationFn: (body: BulkHolidayReq) => bulkUpsertHolidays(body),
  })
}
