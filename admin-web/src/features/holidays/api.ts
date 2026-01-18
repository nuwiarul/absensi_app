import { http } from "@/lib/http"
import type { BulkHolidayReq, BulkHolidayResp } from "./types"

export async function bulkUpsertHolidays(body: BulkHolidayReq): Promise<number> {
  const res = await http.post<BulkHolidayResp>("/holidays/bulk", body)
  return res.data.data.affected_rows
}
