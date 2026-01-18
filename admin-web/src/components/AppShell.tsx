import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom"
import { LogOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import {ThemeToggle} from "@/components/ThemeToggle"
import { clearSession, getSession } from "@/lib/auth"
import { cn } from "@/lib/utils"
import {MobileNavDrawer} from "@/components/layout/mobile-nav-drawer.tsx";
import {getNavItems} from "@/components/layout/nav-items.ts";



function pageTitle(pathname: string) {
    if (pathname.startsWith("/satkers")) return "Satker"
    if (pathname.startsWith("/users")) return "User"
    if (pathname.startsWith("/satker-heads")) return "Satker Head"
    if (pathname.startsWith("/working-days")) return "Working Days"
    return "Dashboard"
}

export default function AppShell() {
    const nav = useNavigate()
    const loc = useLocation()
    const s = getSession()
    const navItems = getNavItems()


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

                {/* Main */}
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

                            <div className="flex items-center gap-2">
                                <ThemeToggle />
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


