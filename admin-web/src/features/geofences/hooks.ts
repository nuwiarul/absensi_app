import { useQuery } from "@tanstack/react-query"
import { useToastMutation } from "@/hooks/use-toast-mutation"
import { createGeofence, deleteGeofence, listGeofences, updateGeofence } from "./api"
import type { CreateGeofenceReq, UpdateGeofenceReq } from "./types"

export const geofencesKeys = {
  all: ["geofences"] as const,
}

export function useGeofences() {
  return useQuery({
    queryKey: geofencesKeys.all,
    queryFn: listGeofences,
  })
}

export function useCreateGeofence() {
  return useToastMutation({
    mutationFn: ({ satkerId, body }: { satkerId: string; body: CreateGeofenceReq }) =>
      createGeofence(satkerId, body),
    successMessage: "Geofence berhasil dibuat",
    invalidateQueries: [geofencesKeys.all],
  })
}

export function useUpdateGeofence() {
  return useToastMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGeofenceReq }) =>
      updateGeofence(id, body),
    successMessage: "Geofence berhasil diupdate",
    invalidateQueries: [geofencesKeys.all],
  })
}

export function useDeleteGeofence() {
  return useToastMutation({
    mutationFn: (id: string) => deleteGeofence(id),
    successMessage: "Geofence berhasil dihapus",
    invalidateQueries: [geofencesKeys.all],
  })
}
