import { http } from "@/lib/http"
import type { ApiResponse, SatkerHead, SetSatkerHeadReq } from "./types"

export async function listSatkerHeads(): Promise<SatkerHead[]> {
  const res = await http.get<ApiResponse<SatkerHead[]>>("/satkers-head/list")
  return res.data.data ?? []
}

export async function setSatkerHead(
  satkerId: string,
  payload: SetSatkerHeadReq
): Promise<string> {
  const res = await http.post<ApiResponse<string>>(
    `/satkers-head/set/${satkerId}`,
    payload
  )
  return res.data.data
}
