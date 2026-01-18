export type Satker = {
    id: string
    code: string
    name: string
    is_active: boolean
    head_user_id?: string | null
    head_full_name?: string | null
}

export type User = {
    id: string
    satker_id: string
    satker_name?: string
    nrp: string
    full_name: string
    email: string
    role: "SUPERADMIN" | "SATKER_ADMIN" | "SATKER_HEAD" | "MEMBER"
    is_active: boolean
}
