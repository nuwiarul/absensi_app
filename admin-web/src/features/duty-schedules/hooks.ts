import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import {
  createDutySchedule,
  deleteDutySchedule,
  listDutySchedules,
  updateDutySchedule,
} from "./api"
import type {
  CreateDutyScheduleReq,
  ListDutySchedulesQuery,
  UpdateDutyScheduleReq,
} from "./types"

export const dutySchedulesKeys = {
  all: ["duty-schedules"] as const,
}

export function useDutySchedules(params: ListDutySchedulesQuery) {
  return useQuery({
    queryKey: ["duty-schedules", params],
    queryFn: () => listDutySchedules(params),
    staleTime: 10_000,
  })
}

export function useCreateDutySchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateDutyScheduleReq) => createDutySchedule(payload),
    onSuccess: (r) => {
      toast.success(r.data || "Jadwal dinas berhasil dibuat")
      qc.invalidateQueries({ queryKey: dutySchedulesKeys.all })
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || e?.message || "Gagal membuat jadwal dinas")
    },
  })
}

export function useUpdateDutySchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateDutyScheduleReq }) => updateDutySchedule(id, payload),
    onSuccess: (r) => {
      toast.success(r.data || "Jadwal dinas berhasil diupdate")
      qc.invalidateQueries({ queryKey: dutySchedulesKeys.all })
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || e?.message || "Gagal mengupdate jadwal dinas")
    },
  })
}

export function useDeleteDutySchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDutySchedule(id),
    onSuccess: (r) => {
      toast.success(r.data || "Jadwal dinas berhasil dihapus")
      qc.invalidateQueries({ queryKey: dutySchedulesKeys.all })
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message || e?.message || "Gagal menghapus jadwal dinas")
    },
  })
}
