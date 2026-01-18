// src/features/satkers/hooks.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createSatker, deleteSatker, listSatkers, updateSatker } from "./api"
import type { CreateSatkerReq, UpdateSatkerReq } from "./types"

export const satkersKeys = {
  all: ["satkers"] as const,
}

export function useSatkers() {
  return useQuery({
    queryKey: satkersKeys.all,
    queryFn: listSatkers,
  })
}

export function useCreateSatker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateSatkerReq) => createSatker(body),
    onSuccess: () => {
      toast.success("Satker berhasil dibuat")
      qc.invalidateQueries({ queryKey: satkersKeys.all })
    },
  })
}

export function useUpdateSatker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSatkerReq }) => updateSatker(id, body),
    onSuccess: () => {
      toast.success("Satker berhasil diupdate")
      qc.invalidateQueries({ queryKey: satkersKeys.all })
    },
  })
}

export function useDeleteSatker() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSatker(id),
    onSuccess: () => {
      toast.success("Satker berhasil dihapus")
      qc.invalidateQueries({ queryKey: satkersKeys.all })
    },
  })
}
