// src/features/satkers/hooks.ts
import { useQuery } from "@tanstack/react-query"
import { useToastMutation } from "@/hooks/use-toast-mutation"
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
  return useToastMutation({
    mutationFn: (body: CreateSatkerReq) => createSatker(body),
    successMessage: "Satker berhasil dibuat",
    invalidateQueries: [satkersKeys.all],
  })
}

export function useUpdateSatker() {
  return useToastMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateSatkerReq }) => updateSatker(id, body),
    successMessage: "Satker berhasil diupdate",
    invalidateQueries: [satkersKeys.all],
  })
}

export function useDeleteSatker() {
  return useToastMutation({
    mutationFn: (id: string) => deleteSatker(id),
    successMessage: "Satker berhasil dihapus",
    invalidateQueries: [satkersKeys.all],
  })
}
