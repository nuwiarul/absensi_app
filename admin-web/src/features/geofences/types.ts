import type { Satker } from "@/features/satkers/types"

export type ApiResponse<T> = {
  status: string
  data: T
}

export type Geofence = {
  id: string
  satker: Satker
  name: string
  latitude: number
  longitude: number
  radius_meters: number
  is_active: boolean
}

export type CreateGeofenceReq = {
  name: string
  latitude: number
  longitude: number
  radius_meters: number
}

export type UpdateGeofenceReq = Partial<CreateGeofenceReq>
