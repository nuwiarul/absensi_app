import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
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
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ satkerId, body }: { satkerId: string; body: CreateGeofenceReq }) =>
      createGeofence(satkerId, body),
    onSuccess: () => {
      toast.success("Geofence berhasil dibuat")
      qc.invalidateQueries({ queryKey: geofencesKeys.all })
    },
  })
}

export function useUpdateGeofence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateGeofenceReq }) => updateGeofence(id, body),
    onSuccess: () => {
      toast.success("Geofence berhasil diupdate")
      qc.invalidateQueries({ queryKey: geofencesKeys.all })
    },
  })
}

export function useDeleteGeofence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteGeofence(id),
    onSuccess: () => {
      toast.success("Geofence berhasil dihapus")
      qc.invalidateQueries({ queryKey: geofencesKeys.all })
    },
  })
}
