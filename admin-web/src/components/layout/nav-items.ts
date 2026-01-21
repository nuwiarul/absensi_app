//import { getSession } from "@/lib/auth"

export type Role = "SUPERADMIN" | "SATKER_ADMIN" | "SATKER_HEAD" | "MEMBER"

export type NavLeaf = {
    label: string
    to: string
}

export type NavGroup = {
    key: string
    label: string
    items: NavLeaf[]
}

type LeafWithRoles = NavLeaf & { roles: Role[] }

type GroupDef = {
    key: string
    label: string
    items: LeafWithRoles[]
}

// Menu utama + sub menu (1 level)
// - Dashboard & Settings single item (no expand)
// - Group lain expandable di sidebar
const GROUPS: GroupDef[] = [
    {
        key: "dashboard",
        label: "Dashboard",
        items: [{ label: "Dashboard", to: "/dashboard", roles: ["SUPERADMIN", "SATKER_ADMIN"] }],
    },
    {
        key: "master",
        label: "Master Data",
        items: [
            { label: "Satker", to: "/satkers", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Pangkat/Golongan", to: "/ranks", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "User", to: "/users", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Satker Head", to: "/satker-heads", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Geofence", to: "/geofences", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Pengumuman", to: "/announcements", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
        ],
    },
    {
        key: "workdays",
        label: "Hari Kerja",
        items: [
            { label: "Work Patterns", to: "/work-patterns", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Holidays", to: "/holidays", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Generate Calendar", to: "/calendar-generate", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Calendar Result", to: "/calendar/result", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
        ],
    },
    {
        key: "attendance",
        label: "Absensi",
        items: [
            { label: "Ijin", to: "/leave-requests", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
            { label: "Jadwal Dinas", to: "/duty-schedules", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
            { label: "Edit Absensi", to: "/attendance/manage", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Rekap Absensi", to: "/attendance/recap", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
        ],
    },
    {
        key: "tukin",
        label: "Tukin",
        items: [
            { label: "Tukin (Policy)", to: "/tukin/policies", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
            { label: "Rekap Tukin", to: "/tukin/calculations", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
        ],
    },
    {
        key: "settings",
        label: "Settings",
        items: [{ label: "Settings", to: "/settings", roles: ["SUPERADMIN"] }],
    },
]

export function getNavGroups(role?: Role): NavGroup[] {
    //const role = (getSession()?.role ?? "SUPERADMIN") as Role
    const r = role ?? "SUPERADMIN"
    return GROUPS.map((g) => {
        const items = g.items
            .filter((it) => it.roles.includes(role))
            .map(({ roles, ...rest }) => rest)
        return { key: g.key, label: g.label, items }
    }).filter((g) => g.items.length > 0)
}

// Back-compat helper
export function getNavItems(): NavLeaf[] {
    return getNavGroups().flatMap((g) => g.items)
}


/*
import { getSession } from "@/lib/auth"

export type Role = "SUPERADMIN" | "SATKER_ADMIN" | "SATKER_HEAD" | "MEMBER"

export type NavLeaf = {
    label: string
    to: string
}

export type NavGroup = {
    label: string
    items: NavLeaf[]
}

type LeafWithRoles = NavLeaf & { roles: Role[] }

type GroupDef = {
    label: string
    items: LeafWithRoles[]
}

// NOTE:
// - Dashboard is a top-level single item.
// - Other menus follow the requested grouping.
const GROUPS: GroupDef[] = [
    {
        label: "Dashboard",
        items: [{ label: "Dashboard", to: "/dashboard", roles: ["SUPERADMIN", "SATKER_ADMIN"] }],
    },
    {
        label: "Master Data",
        items: [
            { label: "Satker", to: "/satkers", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Pangkat/Golongan", to: "/ranks", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "User", to: "/users", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Satker Head", to: "/satker-heads", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Geofence", to: "/geofences", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Pengumuman", to: "/announcements", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
        ],
    },
    {
        label: "Hari Kerja",
        items: [
            { label: "Work Patterns", to: "/work-patterns", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Holidays", to: "/holidays", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Generate Calendar", to: "/calendar-generate", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Calendar Result", to: "/calendar/result", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
        ],
    },
    {
        label: "Absensi",
        items: [
            { label: "Ijin", to: "/leave-requests", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
            { label: "Jadwal Dinas", to: "/duty-schedules", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
            { label: "Edit Absensi", to: "/attendance/manage", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
            { label: "Rekap Absensi", to: "/attendance/recap", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
        ],
    },
    {
        label: "Tukin",
        items: [
            { label: "Tukin (Policy)", to: "/tukin/policies", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
            { label: "Rekap Tukin", to: "/tukin/calculations", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
        ],
    },
    {
        label: "Settings",
        items: [{ label: "Settings", to: "/settings", roles: ["SUPERADMIN"] }],
    },
]

export function getNavGroups(): NavGroup[] {
    const role = (getSession()?.role ?? "SUPERADMIN") as Role
    return GROUPS.map((g) => {
        const items = g.items.filter((it) => it.roles.includes(role)).map(({ roles, ...rest }) => rest)
        return { label: g.label, items }
    }).filter((g) => g.items.length > 0)
}

// Back-compat helper for places that still want a flat list.
export function getNavItems(): NavLeaf[] {
    return getNavGroups().flatMap((g) => g.items)
}


*/
