export type ApiResponse<T> = {
  status: string
  data: T
}

export type Rank = {
  id: string
  code: string
  name: string
  description?: string | null
  tukin_base: number
}

export type CreateRankReq = {
  code: string
  name: string
  description?: string | null
  tukin_base?: number
}

export type UpdateRankReq = Partial<CreateRankReq>
