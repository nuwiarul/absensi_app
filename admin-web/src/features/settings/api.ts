import { http } from "@/lib/http"
import type { TimezoneResp, UpdateTimezoneReq } from "./types"

export async function getTimezone(): Promise<TimezoneResp> {
  const { data } = await http.get<TimezoneResp>("/settings/timezone")
  return data
}

export async function updateTimezone(body: UpdateTimezoneReq): Promise<TimezoneResp> {
  const { data } = await http.put<TimezoneResp>("/settings/timezone", body)
  return data
}
