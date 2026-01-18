// src/features/satkers/types.ts
export type ApiResponse<T> = {
  status: string
  data: T
}

export type Satker = {
  id: string
  code: string
  name: string
  is_active: boolean
}

export type CreateSatkerReq = {
  code: string
  name: string
}

export type UpdateSatkerReq = {
  code: string
  name: string
}
