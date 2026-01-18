import { http } from "@/lib/http"
import type { ApiResponse, CreateGeofenceReq, Geofence, UpdateGeofenceReq } from "./types"

export async function listGeofences(): Promise<Geofence[]> {
  const res = await http.get<ApiResponse<Geofence[]>>("/geofences")
  return res.data.data ?? []
}

export async function createGeofence(satkerId: string, body: CreateGeofenceReq): Promise<string> {
  const res = await http.post<ApiResponse<string>>(`/geofences/create/${satkerId}`, body)
  return res.data.data
}

export async function updateGeofence(id: string, body: UpdateGeofenceReq): Promise<string> {
  const res = await http.put<ApiResponse<string>>(`/geofences/update/${id}`, body)
  return res.data.data
}

export async function deleteGeofence(id: string): Promise<string> {
  const res = await http.delete<ApiResponse<string>>(`/geofences/delete/${id}`)
  return res.data.data
}

export async function getGeofence(id: string): Promise<Geofence> {
  const res = await http.get<ApiResponse<Geofence>>(`/geofences/${id}`)
  return res.data.data
}
