import { useQuery } from "@tanstack/react-query"
import { useToastMutation } from "@/hooks/use-toast-mutation"
import { createRank, deleteRank, fetchRanks, updateRank } from "./api"
import type { CreateRankReq, UpdateRankReq } from "./types"

export const ranksKeys = {
  all: ["ranks"] as const,
}

export function useRanks() {
  return useQuery({ queryKey: ranksKeys.all, queryFn: fetchRanks })
}

export function useCreateRank() {
  return useToastMutation({
    mutationFn: (body: CreateRankReq) => createRank(body),
    successMessage: "Pangkat/Golongan berhasil dibuat",
    invalidateQueries: [ranksKeys.all],
  })
}

export function useUpdateRank() {
  return useToastMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRankReq }) => updateRank(id, body),
    successMessage: "Pangkat/Golongan berhasil diupdate",
    invalidateQueries: [ranksKeys.all],
  })
}

export function useDeleteRank() {
  return useToastMutation({
    mutationFn: (id: string) => deleteRank(id),
    successMessage: "Pangkat/Golongan berhasil dihapus",
    invalidateQueries: [ranksKeys.all],
  })
}
