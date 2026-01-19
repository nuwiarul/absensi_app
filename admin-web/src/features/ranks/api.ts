import { http } from "@/lib/http"
import type { ApiResponse, CreateRankReq, Rank, UpdateRankReq } from "./types"

export async function fetchRanks(): Promise<Rank[]> {
  const res = await http.get<ApiResponse<Rank[]>>("/ranks")
  return res.data.data
}

export async function createRank(payload: CreateRankReq): Promise<Rank> {
  const res = await http.post<ApiResponse<Rank>>("/ranks/create", payload)
  return res.data.data
}

export async function updateRank(id: string, payload: UpdateRankReq): Promise<void> {
  await http.put(`/ranks/update/${id}`, payload)
}

export async function deleteRank(id: string): Promise<void> {
  await http.delete(`/ranks/delete/${id}`)
}
