import * as React from "react"

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {ThemeToggle} from "@/components/ThemeToggle"
import { clearSession, getSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {MobileNavDrawer} from "@/components/layout/mobile-nav-drawer.tsx";
import { getNavGroups } from "@/components/layout/nav-items.ts";
import { AuthedAvatar } from "@/components/AuthedAvatar"
import { getMe } from "@/features/users/api"

import { ChevronDown, ChevronRight } from "lucide-react"



function pageTitle(pathname: string) {
    if (pathname.startsWith("/satkers")) return "Satker"
    if (pathname.startsWith("/users")) return "User"
    if (pathname.startsWith("/satker-heads")) return "Satker Head"
    if (pathname.startsWith("/working-days")) return "Working Days"
    if (pathname.startsWith("/announcements")) return "Pengumuman"
    if (pathname.startsWith("/profile")) return "Profil Saya"
    if (pathname.startsWith("/change-password")) return "Ganti Password"
    return "Dashboard"
}

export default function AppShell() {
    const nav = useNavigate()
    const loc = useLocation()
    const [s, setS] = React.useState(() => getSession())
    //const navGroups = getNavGroups()
    const navGroups = React.useMemo(() => getNavGroups(s?.role), [s?.role])
    //const navItems = React.useMemo(() => navGroups.flatMap((g) => g.items), [navGroups])

    // Keep session reactive so sidebar/header instantly reflect updated full name, etc.
    React.useEffect(() => {
        const onChanged = () => setS(getSession())
        window.addEventListener("session:changed", onChanged)
        return () => window.removeEventListener("session:changed", onChanged)
    }, [])

    // Fetch current user for avatar (session tidak menyimpan profile_photo_key).
    const [mePhotoKey, setMePhotoKey] = React.useState<string | null>(null)
    const [mePhotoNonce, setMePhotoNonce] = React.useState(0)
    const refetchMePhoto = React.useCallback(() => {
        let alive = true
        ;(async () => {
            try {
                const me = await getMe()
                if (alive) setMePhotoKey(me.profile_photo_key ?? null)
            } catch {
                // ignore
            }
        })()
        return () => {
            alive = false
        }
    }, [])

    React.useEffect(() => {
        const cleanup = refetchMePhoto()
        const onUpdated = () => {
            setMePhotoNonce((n) => n + 1)
            const c = refetchMePhoto()
            // immediately run; cleanup is handled by refetch closure
            void c
        }
        window.addEventListener("me:updated", onUpdated)
        return () => {
            cleanup?.()
            window.removeEventListener("me:updated", onUpdated)
        }
    }, [refetchMePhoto])

    const [menuOpen, setMenuOpen] = React.useState(false)
    const menuRef = React.useRef<HTMLDivElement | null>(null)
    React.useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!menuOpen) return
            const el = menuRef.current
            if (!el) return
            if (e.target instanceof Node && !el.contains(e.target)) {
                setMenuOpen(false)
            }
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false)
        }
        document.addEventListener("mousedown", onDoc)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDoc)
            document.removeEventListener("keydown", onKey)
        }
    }, [menuOpen])

    const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})

// Auto expand group saat route aktif (biar pas refresh tetap kebuka)
    React.useEffect(() => {
        setOpenGroups((prev) => {
            let changed = false
            const next = { ...prev }

            for (const g of navGroups) {
                const isExpandable = g.items.length > 1
                if (!isExpandable) continue

                const active = g.items.some(
                    (it) =>
                        loc.pathname === it.to ||
                        loc.pathname.startsWith(it.to + "/") ||
                        loc.pathname.startsWith(it.to)
                )

                // hanya paksa open kalau active dan sebelumnya belum open
                if (active && !next[g.key]) {
                    next[g.key] = true
                    changed = true
                }
            }

            return changed ? next : prev
        })
    }, [loc.pathname, navGroups])


    return (
        <div className="min-h-screen bg-background">
            <div className="grid md:grid-cols-[260px_1fr]">
                {/* Sidebar (desktop) */}
                <aside className="hidden md:block border-r bg-sidebar text-sidebar-foreground min-h-screen">
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo_pontianak.png"
                                alt="Logo Polresta Pontianak Kota"
                                className="h-9 w-9"
                            />
                            <div>
                                <div className="font-semibold leading-tight">Admin Absensi</div>
                                <div className="text-xs text-muted-foreground">Polresta Pontianak Kota</div>
                            </div>
                        </div>

                        <div className="text-sm">
                            <div className="font-medium">{s?.fullName}</div>
                            <div className="text-xs text-muted-foreground">{s?.role}</div>
                            <div className="text-xs text-muted-foreground">
                                {s?.satkerName} ({s?.satkerCode})
                            </div>
                        </div>

                        {/*<nav className="space-y-3">
                            {navGroups.map((group) => (
                                <div key={group.label} className="space-y-1">
                                    {group.label !== "Dashboard" ? (
                                        <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                            {group.label}
                                        </div>
                                    ) : null}

                                    <div className="space-y-1">
                                        {group.items.map((item) => (
                                            <NavLink
                                                key={item.to}
                                                to={item.to}
                                                className={({ isActive }) =>
                                                    cn(
                                                        "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                                                        isActive ? "bg-sidebar-accent font-medium" : "text-sidebar-foreground"
                                                    )
                                                }
                                            >
                                                {item.label}
                                            </NavLink>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </nav>*/}

                        <nav className="space-y-1">
                            {navGroups.map((group) => {
                                const isSingle = group.items.length === 1
                                const singleItem = isSingle ? group.items[0] : null
                                const isExpandable = !isSingle // group dengan sub-menu

                                const isGroupActive = group.items.some((it) => loc.pathname === it.to || loc.pathname.startsWith(it.to + "/") || loc.pathname.startsWith(it.to))

                                // state expand/collapse per group (default: expand jika active)
                                // NOTE: kita simpan state di component; init/auto-expand handled di effect bawah
                                const open = (openGroups[group.key] ?? false)

                                if (!isExpandable && singleItem) {
                                    // Dashboard & Settings tampil seperti item biasa
                                    return (
                                        <NavLink
                                            key={group.key}
                                            to={singleItem.to}
                                            className={({ isActive }) =>
                                                cn(
                                                    "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                                                    isActive ? "bg-sidebar-accent font-medium" : "text-sidebar-foreground"
                                                )
                                            }
                                        >
                                            {group.label}
                                        </NavLink>
                                    )
                                }

                                return (
                                    <div key={group.key} className="space-y-1">
                                        <button
                                            type="button"
                                            onClick={() => setOpenGroups((prev) => ({ ...prev, [group.key]: !open }))}
                                            className={cn(
                                                "w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                                                isGroupActive ? "bg-sidebar-accent/60 font-medium" : "text-sidebar-foreground"
                                            )}
                                        >
                                            <span>{group.label}</span>
                                            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        </button>

                                        {open ? (
                                            <div className="pl-3 space-y-1">
                                                {group.items.map((item) => (
                                                    <NavLink
                                                        key={item.to}
                                                        to={item.to}
                                                        className={({ isActive }) =>
                                                            cn(
                                                                "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                                                                isActive ? "bg-sidebar-accent font-medium" : "text-sidebar-foreground"
                                                            )
                                                        }
                                                    >
                                                        {item.label}
                                                    </NavLink>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                )
                            })}
                        </nav>


                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => {
                                clearSession()
                                nav("/login", { replace: true })
                            }}
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </aside>

                {/* Main */}
                <div className="min-w-0">
                    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
                        <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">

                                <MobileNavDrawer
                                    groups={navGroups}
                                    onLogout={() => {
                                        clearSession()
                                        nav("/login", { replace: true })
                                    }}
                                    logoSrc="/logo_pontianak.png"
                                    title="Admin Absensi"
                                    subtitle="Polresta Pontianak Kota"
                                />

                                {/* Mobile logo */}
                                <div className="md:hidden flex items-center gap-2">
                                    <img
                                        src="/logo_pontianak.png"
                                        alt="Logo"
                                        className="h-8 w-8"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold truncate">{pageTitle(loc.pathname)}</div>
                                    {s && (
                                        <div className="text-xs text-muted-foreground truncate">
                                            {s.satkerName} • {s.fullName}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2" ref={menuRef}>
                                <ThemeToggle />

                                {/* Avatar menu */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        onClick={() => setMenuOpen((v) => !v)}
                                        aria-label="Menu akun"
                                    >
                                        <AuthedAvatar objectKey={mePhotoKey} nonce={mePhotoNonce} alt={s?.fullName} size={32} />
                                    </button>

                                    {menuOpen ? (
                                        <div className="absolute right-0 mt-2 w-44 rounded-md border bg-background shadow-lg overflow-hidden">
                                            <button
                                                type="button"
                                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted"
                                                onClick={() => {
                                                    setMenuOpen(false)
                                                    nav("/profile")
                                                }}
                                            >
                                                Profil Saya
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted"
                                                onClick={() => {
                                                    setMenuOpen(false)
                                                    nav("/change-password")
                                                }}
                                            >
                                                Ganti Password
                                            </button>
                                        </div>
                                    ) : null}
                                </div>

                                <Button
                                    variant="outline"
                                    className="md:hidden"
                                    onClick={() => {
                                        clearSession()
                                        nav("/login", { replace: true })
                                    }}
                                >
                                    Logout
                                </Button>
                            </div>
                        </div>
                    </header>

                    <main className="p-4 md:p-6 max-w-[1200px] mx-auto">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    )
}




/*
import * as React from "react"

import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {ThemeToggle} from "@/components/ThemeToggle"
import { clearSession, getSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {MobileNavDrawer} from "@/components/layout/mobile-nav-drawer.tsx";
import {getNavItems} from "@/components/layout/nav-items.ts";
import { AuthedAvatar } from "@/components/AuthedAvatar"
import { getMe } from "@/features/users/api"



function pageTitle(pathname: string) {
    if (pathname === "/" || pathname.startsWith("/dashboard")) return "Dashboard"
    if (pathname.startsWith("/satkers")) return "Satker"
    if (pathname.startsWith("/users")) return "User"
    if (pathname.startsWith("/satker-heads")) return "Satker Head"
    if (pathname.startsWith("/working-days")) return "Working Days"
    if (pathname.startsWith("/announcements")) return "Pengumuman"
    if (pathname.startsWith("/profile")) return "Profil Saya"
    if (pathname.startsWith("/change-password")) return "Ganti Password"
    return "Dashboard"
}

export default function AppShell() {
    const nav = useNavigate()
    const loc = useLocation()
    const [s, setS] = React.useState(() => getSession())
    const navItems = getNavItems()

    // Keep session reactive so sidebar/header instantly reflect updated full name, etc.
    React.useEffect(() => {
        const onChanged = () => setS(getSession())
        window.addEventListener("session:changed", onChanged)
        return () => window.removeEventListener("session:changed", onChanged)
    }, [])

    // Fetch current user for avatar (session tidak menyimpan profile_photo_key).
    const [mePhotoKey, setMePhotoKey] = React.useState<string | null>(null)
    const [mePhotoNonce, setMePhotoNonce] = React.useState(0)
    const refetchMePhoto = React.useCallback(() => {
        let alive = true
        ;(async () => {
            try {
                const me = await getMe()
                if (alive) setMePhotoKey(me.profile_photo_key ?? null)
            } catch {
                // ignore
            }
        })()
        return () => {
            alive = false
        }
    }, [])

    React.useEffect(() => {
        const cleanup = refetchMePhoto()
        const onUpdated = () => {
            setMePhotoNonce((n) => n + 1)
            const c = refetchMePhoto()
            // immediately run; cleanup is handled by refetch closure
            void c
        }
        window.addEventListener("me:updated", onUpdated)
        return () => {
            cleanup?.()
            window.removeEventListener("me:updated", onUpdated)
        }
    }, [refetchMePhoto])

    const [menuOpen, setMenuOpen] = React.useState(false)
    const menuRef = React.useRef<HTMLDivElement | null>(null)
    React.useEffect(() => {
        const onDoc = (e: MouseEvent) => {
            if (!menuOpen) return
            const el = menuRef.current
            if (!el) return
            if (e.target instanceof Node && !el.contains(e.target)) {
                setMenuOpen(false)
            }
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMenuOpen(false)
        }
        document.addEventListener("mousedown", onDoc)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDoc)
            document.removeEventListener("keydown", onKey)
        }
    }, [menuOpen])


    return (
        <div className="min-h-screen bg-background">
            <div className="grid md:grid-cols-[260px_1fr]">
                {/!* Sidebar (desktop) *!/}
                <aside className="hidden md:block border-r bg-sidebar text-sidebar-foreground min-h-screen">
                    <div className="p-4 space-y-4">
                        <div className="flex items-center gap-3">
                            <img
                                src="/logo_pontianak.png"
                                alt="Logo Polresta Pontianak Kota"
                                className="h-9 w-9"
                            />
                            <div>
                                <div className="font-semibold leading-tight">Admin Absensi</div>
                                <div className="text-xs text-muted-foreground">Polresta Pontianak Kota</div>
                            </div>
                        </div>

                        <div className="text-sm">
                            <div className="font-medium">{s?.fullName}</div>
                            <div className="text-xs text-muted-foreground">{s?.role}</div>
                            <div className="text-xs text-muted-foreground">
                                {s?.satkerName} ({s?.satkerCode})
                            </div>
                        </div>

                        <nav className="space-y-1">
                            {navItems.map((item) => (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        cn(
                                            "block rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                                            isActive ? "bg-sidebar-accent font-medium" : "text-sidebar-foreground"
                                        )
                                    }
                                >
                                    {item.label}
                                </NavLink>
                            ))}
                        </nav>

                        <Button
                            variant="outline"
                            className="w-full justify-start gap-2"
                            onClick={() => {
                                clearSession()
                                nav("/login", { replace: true })
                            }}
                        >
                            <LogOut className="h-4 w-4" />
                            Logout
                        </Button>
                    </div>
                </aside>

                {/!* Main *!/}
                <div className="min-w-0">
                    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
                        <div className="h-14 px-4 md:px-6 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">

                                <MobileNavDrawer
                                    items={navItems}
                                    onLogout={() => {
                                        clearSession()
                                        nav("/login", { replace: true })
                                    }}
                                    logoSrc="/logo_pontianak.png"
                                    title="Admin Absensi"
                                    subtitle="Polresta Pontianak Kota"
                                />

                                {/!* Mobile logo *!/}
                                <div className="md:hidden flex items-center gap-2">
                                    <img
                                        src="/logo_pontianak.png"
                                        alt="Logo"
                                        className="h-8 w-8"
                                    />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-sm font-semibold truncate">{pageTitle(loc.pathname)}</div>
                                    {s && (
                                        <div className="text-xs text-muted-foreground truncate">
                                            {s.satkerName} • {s.fullName}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-2" ref={menuRef}>
                                <ThemeToggle />

                                {/!* Avatar menu *!/}
                                <div className="relative">
                                    <button
                                        type="button"
                                        className="inline-flex items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                        onClick={() => setMenuOpen((v) => !v)}
                                        aria-label="Menu akun"
                                    >
                                        <AuthedAvatar objectKey={mePhotoKey} nonce={mePhotoNonce} alt={s?.fullName} size={32} />
                                    </button>

                                    {menuOpen ? (
                                        <div className="absolute right-0 mt-2 w-44 rounded-md border bg-background shadow-lg overflow-hidden">
                                            <button
                                                type="button"
                                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted"
                                                onClick={() => {
                                                    setMenuOpen(false)
                                                    nav("/profile")
                                                }}
                                            >
                                                Profil Saya
                                            </button>
                                            <button
                                                type="button"
                                                className="w-full px-3 py-2 text-sm text-left hover:bg-muted"
                                                onClick={() => {
                                                    setMenuOpen(false)
                                                    nav("/change-password")
                                                }}
                                            >
                                                Ganti Password
                                            </button>
                                        </div>
                                    ) : null}
                                </div>

                                <Button
                                    variant="outline"
                                    className="md:hidden"
                                    onClick={() => {
                                        clearSession()
                                        nav("/login", { replace: true })
                                    }}
                                >
                                    Logout
                                </Button>
                            </div>
                        </div>
                    </header>

                    <main className="p-4 md:p-6 max-w-[1200px] mx-auto">
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    )
}




*/
