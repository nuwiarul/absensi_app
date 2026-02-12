import { useQuery } from "@tanstack/react-query"
import { useToastMutation } from "@/hooks/use-toast-mutation"

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
  return useToastMutation<string, unknown, CreateUserReq>({
    mutationFn: (payload: CreateUserReq) => createUser(payload),
    successMessage: (msg) => msg ?? "User berhasil dibuat",
    invalidateQueries: [usersKeys.all],
  })
}

export function useUpdateUser() {
  return useToastMutation<string, unknown, { id: string; payload: UpdateUserReq }>({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateUserReq }) =>
      updateUser(id, payload),
    successMessage: (msg) => msg ?? "User berhasil diupdate",
    invalidateQueries: [usersKeys.all],
  })
}

export function useDeleteUser() {
  return useToastMutation<string, unknown, string>({
    mutationFn: (id: string) => deleteUser(id),
    successMessage: (msg) => msg ?? "User berhasil dihapus",
    invalidateQueries: [usersKeys.all],
  })
}
