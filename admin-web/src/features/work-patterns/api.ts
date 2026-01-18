import { http } from "@/lib/http"
import type { SatkerWorkPattern, UpsertWorkPatternReq, WorkPatternsResp, UpsertWorkPatternResp } from "./types"

export async function listWorkPatterns(satkerId: string): Promise<SatkerWorkPattern[]> {
  const res = await http.get<WorkPatternsResp>(`/satkers/${satkerId}/work-patterns`)
  return res.data.data
}

export async function upsertWorkPattern(satkerId: string, body: UpsertWorkPatternReq): Promise<SatkerWorkPattern> {
  const res = await http.post<UpsertWorkPatternResp>(`/satkers/${satkerId}/work-patterns`, body)
  return res.data.data
}

export async function deleteWorkPattern(satkerId: string, effectiveFrom: string): Promise<void> {
  await http.delete(`/satkers/${satkerId}/work-patterns/${effectiveFrom}`)
}
