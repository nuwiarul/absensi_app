// src/features/satkers/api.ts
import { http } from "@/lib/http"
import type { ApiResponse, Satker, CreateSatkerReq, UpdateSatkerReq } from "./types"

export async function listSatkers(): Promise<Satker[]> {
  const res = await http.get<ApiResponse<Satker[]>>("/satkers")
  return res.data.data
}

export async function createSatker(body: CreateSatkerReq): Promise<string> {
  const res = await http.post<ApiResponse<string>>("/satkers/create", body)
  return res.data.data
}

export async function updateSatker(id: string, body: UpdateSatkerReq): Promise<string> {
  const res = await http.put<ApiResponse<string>>(`/satkers/update/${id}`, body)
  return res.data.data
}

export async function deleteSatker(id: string): Promise<string> {
  const res = await http.delete<ApiResponse<string>>(`/satkers/delete/${id}`)
  return res.data.data
}
