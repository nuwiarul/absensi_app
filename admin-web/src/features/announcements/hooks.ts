import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { createAnnouncement, deleteAnnouncement, listManageableAnnouncements, updateAnnouncement } from "./api"
import type { CreateAnnouncementReq, UpdateAnnouncementReq } from "./types"

export const announcementKeys = {
  manageable: () => ["announcements", "admin"] as const,
}

export function useManageableAnnouncements(enabled = true) {
  return useQuery({
    queryKey: announcementKeys.manageable(),
    queryFn: () => listManageableAnnouncements(),
    enabled,
  })
}

export function useCreateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAnnouncementReq) => createAnnouncement(body),
    onSuccess: () => {
      toast.success("Pengumuman berhasil dibuat")
      qc.invalidateQueries({ queryKey: announcementKeys.manageable() })
    },
  })
}

export function useUpdateAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAnnouncementReq }) => updateAnnouncement(id, body),
    onSuccess: () => {
      toast.success("Pengumuman berhasil diperbarui")
      qc.invalidateQueries({ queryKey: announcementKeys.manageable() })
    },
  })
}

export function useDeleteAnnouncement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    onSuccess: () => {
      toast.success("Pengumuman berhasil dihapus")
      qc.invalidateQueries({ queryKey: announcementKeys.manageable() })
    },
  })
}
