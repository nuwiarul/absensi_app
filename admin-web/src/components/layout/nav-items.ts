import type {NavItem} from "@/components/layout/mobile-nav-drawer.tsx";

import { getSession } from "@/lib/auth"

type Role = "SUPERADMIN" | "SATKER_ADMIN" | "SATKER_HEAD" | "MEMBER"

const ALL: (NavItem & { roles: Role[] })[] = [
    { label: "Satker", to: "/satkers", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "User", to: "/users", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Satker Head", to: "/satker-heads", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Geofence", to: "/geofences", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Pangkat/Golongan", to: "/ranks", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Work Patterns", to: "/work-patterns", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Holidays", to: "/holidays", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Generate Calendar", to: "/calendar-generate", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Calendar Result", to: "/calendar/result", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Edit Absensi", to: "/attendance/manage", roles: ["SUPERADMIN"] },
    { label: "Rekap Absensi", to: "/attendance/recap", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
    { label: "Leave Requests", to: "/leave-requests", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
    { label: "Jadwal Dinas", to: "/duty-schedules", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
    { label: "Tukin (Laporan)", to: "/tukin/calculations", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
    { label: "Tukin (Policy)", to: "/tukin/policies", roles: ["SUPERADMIN", "SATKER_ADMIN", "SATKER_HEAD"] },
    { label: "Settings", to: "/settings", roles: ["SUPERADMIN"] },
]

export function getNavItems(): NavItem[] {
    const role = (getSession()?.role ?? "SUPERADMIN") as Role
    return ALL.filter((i) => i.roles.includes(role)).map(({ roles, ...rest }) => rest)
}