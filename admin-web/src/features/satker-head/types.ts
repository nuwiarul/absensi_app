export type ApiResponse<T> = {
  status: string
  data: T
}

export type SatkerHead = {
  user_id: string
  full_name: string
  nrp: string
  phone?: string | null
  satker_id: string
  satker_name: string
  satker_code: string
  active_from: string
  active_to?: string | null
  status?: string | null
}

export type SetSatkerHeadReq = {
  user_id: string
}
