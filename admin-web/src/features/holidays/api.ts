import { http } from "@/lib/http.ts"
import type {
  BulkHolidayReq,
  BulkHolidayResp,
  ListHolidaysQuery,
  ListHolidaysResp,
  UpsertHolidayReq,
  UpsertHolidayResp,
} from "./types"

export async function bulkUpsertHolidays(body: BulkHolidayReq): Promise<number> {
  const res = await http.post<BulkHolidayResp>("/holidays/bulk", body)
  return res.data.data.affected_rows
}

export async function listHolidays(q: ListHolidaysQuery) {
  const res = await http.get<ListHolidaysResp>("/holidays", { params: q })
  return res.data.data
}

export async function upsertHoliday(body: UpsertHolidayReq) {
  const res = await http.put<UpsertHolidayResp>("/holidays", body)
  return res.data.data
}

export async function deleteHoliday(params: {
  scope: "NATIONAL" | "SATKER"
  satker_id?: string | null
  holiday_date: string
}) {
  const res = await http.delete<UpsertHolidayResp>("/holidays", { params })
  return res.data.data
}
