import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { useToastMutation } from "@/hooks/use-toast-mutation"
import { apiErrorMessage } from "@/lib/api-error"

import {
  createDutySchedule,
  deleteDutySchedule,
  listDutySchedules,
  updateDutySchedule,
} from "./api"
import type {
  ApiResponse,
  CreateDutyScheduleReq,
  ListDutySchedulesQuery,
  UpdateDutyScheduleReq,
} from "./types"

export const dutySchedulesKeys = {
  all: ["duty-schedules"] as const,
}

export function useDutySchedules(params: ListDutySchedulesQuery, enabled: boolean = true) {
  return useQuery({
    queryKey: ["duty-schedules", params],
    queryFn: () => listDutySchedules(params),
    staleTime: 10_000,
    enabled,
  })
}

export function useCreateDutySchedule() {
  return useToastMutation<ApiResponse<string>, unknown, CreateDutyScheduleReq>({
    mutationFn: (payload: CreateDutyScheduleReq) => createDutySchedule(payload),
    successMessage: (r) => r.data || "Jadwal dinas berhasil dibuat",
    invalidateQueries: [dutySchedulesKeys.all],
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, { fallbackMessage: "Gagal membuat jadwal dinas" }))
    },
  })
}

export function useUpdateDutySchedule() {
  return useToastMutation<ApiResponse<string>, unknown, { id: string; payload: UpdateDutyScheduleReq }>({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDutyScheduleReq }) =>
      updateDutySchedule(id, payload),
    successMessage: (r) => r.data || "Jadwal dinas berhasil diupdate",
    invalidateQueries: [dutySchedulesKeys.all],
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, { fallbackMessage: "Gagal mengupdate jadwal dinas" }))
    },
  })
}

export function useDeleteDutySchedule() {
  return useToastMutation<ApiResponse<string>, unknown, string>({
    mutationFn: (id: string) => deleteDutySchedule(id),
    successMessage: (r) => r.data || "Jadwal dinas berhasil dihapus",
    invalidateQueries: [dutySchedulesKeys.all],
    onError: (err: unknown) => {
      toast.error(apiErrorMessage(err, { fallbackMessage: "Gagal menghapus jadwal dinas" }))
    },
  })
}
