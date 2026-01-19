import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {getUsers, createUser, updateUser, deleteUser, getUsersBySatker} from "./api"
import type { CreateUserReq, UpdateUserReq } from "./types"

export const usersKeys = {
  all: ["users"] as const,
}

export function useUsers(satkerId?: string, enabled: boolean = true) {
  return useQuery({
    queryKey: ["users", satkerId ?? "ALL"],
    queryFn: () => (satkerId ? getUsersBySatker(satkerId) : getUsers()),
    enabled,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateUserReq) => createUser(payload),
    onSuccess: (msg) => {
      toast.success(msg || "User berhasil dibuat")
      qc.invalidateQueries({ queryKey: usersKeys.all })
    },
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserReq }) =>
      updateUser(id, payload),
    onSuccess: (msg) => {
      toast.success(msg || "User berhasil diupdate")
      qc.invalidateQueries({ queryKey: usersKeys.all })
    },
  })
}

export function useDeleteUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteUser(id),
    onSuccess: (msg) => {
      toast.success(msg || "User berhasil dihapus")
      qc.invalidateQueries({ queryKey: usersKeys.all })
    },
  })
}
