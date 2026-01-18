export type ApiResponse<T> = {
    status: string
    data: T
}

export type UserRole =
    | "SUPERADMIN"
    | "SATKER_ADMIN"
    | "SATKER_HEAD"
    | "MEMBER"

export type SatkerLite = {
    id: string
    code: string
    name: string
    is_active: boolean
}

export type User = {
    id: string
    satker: SatkerLite
    nrp: string
    full_name: string
    email: string
    phone: string | null
    role: UserRole
    is_active: boolean
}

export type CreateUserReq = {
    satker_id: string
    nrp: string
    full_name: string
    email: string
    phone?: string | null
    role?: UserRole
    password: string
    password_confirm: string
}

export type UpdateUserReq = {
    satker_id?: string
    nrp?: string
    full_name?: string
    email?: string
    phone?: string | null
}
