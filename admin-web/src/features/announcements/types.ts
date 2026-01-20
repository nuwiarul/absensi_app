export type AnnouncementScope = "GLOBAL" | "SATKER"

export type Announcement = {
  id: string
  scope: AnnouncementScope
  satker_id?: string | null
  satker_name?: string | null
  satker_code?: string | null
  title: string
  body: string
  is_active: boolean
  created_by: string
  created_by_name: string
  created_at: string
  updated_at: string
}

export type ListAnnouncementsResp = {
  status: string
  data: Announcement[]
}

export type CreateAnnouncementReq = {
  scope: AnnouncementScope
  satker_id?: string | null
  title: string
  body: string
  is_active?: boolean
}

export type UpdateAnnouncementReq = {
  scope?: AnnouncementScope
  satker_id?: string | null
  title?: string
  body?: string
  is_active?: boolean
}

export type CreateAnnouncementResp = { status: string; data: string }
export type OkResp = { status: string; data: string }
