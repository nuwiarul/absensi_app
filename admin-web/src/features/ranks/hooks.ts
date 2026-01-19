import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createRank, deleteRank, fetchRanks, updateRank } from "./api"
import type { CreateRankReq, UpdateRankReq } from "./types"

export const ranksKeys = {
  all: ["ranks"] as const,
}

export function useRanks() {
  return useQuery({ queryKey: ranksKeys.all, queryFn: fetchRanks })
}

export function useCreateRank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateRankReq) => createRank(body),
    onSuccess: () => {
      toast.success("Pangkat/Golongan berhasil dibuat")
      qc.invalidateQueries({ queryKey: ranksKeys.all })
    },
  })
}

export function useUpdateRank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateRankReq }) => updateRank(id, body),
    onSuccess: () => {
      toast.success("Pangkat/Golongan berhasil diupdate")
      qc.invalidateQueries({ queryKey: ranksKeys.all })
    },
  })
}

export function useDeleteRank() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteRank(id),
    onSuccess: () => {
      toast.success("Pangkat/Golongan berhasil dihapus")
      qc.invalidateQueries({ queryKey: ranksKeys.all })
    },
  })
}
