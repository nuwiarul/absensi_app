import type {NavItem} from "@/components/layout/mobile-nav-drawer.tsx";

import { getSession } from "@/lib/auth"

type Role = "SUPERADMIN" | "SATKER_ADMIN" | "SATKER_HEAD" | "MEMBER"

const ALL: (NavItem & { roles: Role[] })[] = [
    { label: "Satker", to: "/satkers", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "User", to: "/users", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Satker Head", to: "/satker-heads", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Geofence", to: "/geofences", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Work Patterns", to: "/work-patterns", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Holidays", to: "/holidays", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Generate Calendar", to: "/calendar-generate", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Calendar Result", to: "/calendar/result", roles: ["SUPERADMIN", "SATKER_ADMIN"] },
    { label: "Settings", to: "/settings", roles: ["SUPERADMIN"] },
]

export function getNavItems(): NavItem[] {
    const role = (getSession()?.role ?? "SUPERADMIN") as Role
    return ALL.filter((i) => i.roles.includes(role)).map(({ roles, ...rest }) => rest)
}