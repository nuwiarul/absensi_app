import { http } from "@/lib/http"
import type {
  CreateAnnouncementReq,
  CreateAnnouncementResp,
  ListAnnouncementsResp,
  OkResp,
  UpdateAnnouncementReq,
} from "./types"

// GET /announcements/admin
export async function listManageableAnnouncements(): Promise<ListAnnouncementsResp> {
  const { data } = await http.get<ListAnnouncementsResp>("/announcements/admin")
  return data
}

// GET /announcements (visible to current user)
export async function listVisibleAnnouncements(): Promise<ListAnnouncementsResp> {
  const { data } = await http.get<ListAnnouncementsResp>("/announcements")
  return data
}

// POST /announcements
export async function createAnnouncement(body: CreateAnnouncementReq): Promise<CreateAnnouncementResp> {
  const { data } = await http.post<CreateAnnouncementResp>("/announcements", body)
  return data
}

// PUT /announcements/:id
export async function updateAnnouncement(id: string, body: UpdateAnnouncementReq): Promise<OkResp> {
  const { data } = await http.put<OkResp>(`/announcements/${id}`, body)
  return data
}

// DELETE /announcements/:id
export async function deleteAnnouncement(id: string): Promise<OkResp> {
  const { data } = await http.delete<OkResp>(`/announcements/${id}`)
  return data
}
