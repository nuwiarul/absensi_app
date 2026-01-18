export type Role = "SUPERADMIN" | "SATKER_ADMIN" | "SATKER_HEAD" | "MEMBER"

export type Session = {
    token: string
    userId: string
    nrp: string
    fullName: string
    role: Role
    satkerId: string
    satkerName: string
    satkerCode: string
}

const KEY = "admin_session_v1"

export function getSession(): Session | null {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    try {
        return JSON.parse(raw) as Session
    } catch {
        return null
    }
}

export function setSession(s: Session) {
    localStorage.setItem(KEY, JSON.stringify(s))
}

export function clearSession() {
    localStorage.removeItem(KEY)
}

export function getToken(): string | null {
    return getSession()?.token ?? null
}

export function isAdminRole(role: Role) {
    return role === "SUPERADMIN" || role === "SATKER_ADMIN"
}
