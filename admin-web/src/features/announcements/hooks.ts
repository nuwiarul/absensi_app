import { useQuery } from "@tanstack/react-query"
import { useToastMutation } from "@/hooks/use-toast-mutation"
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
  return useToastMutation({
    mutationFn: (body: CreateAnnouncementReq) => createAnnouncement(body),
    successMessage: "Pengumuman berhasil dibuat",
    invalidateQueries: [announcementKeys.manageable()],
  })
}

export function useUpdateAnnouncement() {
  return useToastMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateAnnouncementReq }) =>
      updateAnnouncement(id, body),
    successMessage: "Pengumuman berhasil diperbarui",
    invalidateQueries: [announcementKeys.manageable()],
  })
}

export function useDeleteAnnouncement() {
  return useToastMutation({
    mutationFn: (id: string) => deleteAnnouncement(id),
    successMessage: "Pengumuman berhasil dihapus",
    invalidateQueries: [announcementKeys.manageable()],
  })
}
