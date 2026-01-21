import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Menu, X, LogOut } from "lucide-react"
import {VisuallyHidden} from "@radix-ui/react-visually-hidden";
import { ChevronDown, ChevronRight } from "lucide-react"

export type NavItem = {
    label: string
    to: string
}

export type NavGroup = {
    label: string
    items: NavItem[]
}

type Props = {
    logoSrc?: string
    title?: string
    subtitle?: string
    items?: NavItem[]
    groups?: NavGroup[]
    onLogout?: () => void
}

export function MobileNavDrawer({
                                    logoSrc = "/logo_pontianak.png",
                                    title = "Admin Absensi",
                                    subtitle = "Polresta Pontianak Kota",
                                    items,
                                    groups,
                                    onLogout,
                                }: Props) {
    const [open, setOpen] = React.useState(false)
    const location = useLocation()
    const navigate = useNavigate()

    const go = (to: string) => {
        navigate(to)
        setOpen(false)
    }

    const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/")

    const renderItem = (it: NavItem) => (
        <button
            key={it.to}
            type="button"
            onClick={() => go(it.to)}
            className={cn(
                "w-full text-left block rounded-md px-3 py-2 text-sm transition-colors",
                "hover:bg-sidebar-accent",
                isActive(it.to) ? "bg-sidebar-accent font-medium" : ""
            )}
        >
            {it.label}
        </button>
    )

    const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>({})

    React.useEffect(() => {
        if (!groups?.length) return
        setOpenGroups((prev) => {
            let changed = false
            const next = { ...prev }
            for (const g of groups) {
                const expandable = g.items.length > 1
                if (!expandable) continue
                const active = g.items.some((it) => isActive(it.to))
                if (active && !next[g.label]) {
                    next[g.label] = true
                    changed = true
                }
            }
            return changed ? next : prev
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [location.pathname, groups])


    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                    <Menu className="h-4 w-4" />
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                {/* Overlay */}
                <Dialog.Overlay
                    className={cn(
                        "fixed inset-0 z-50 bg-black/50",
                        "data-[state=open]:[animation:drawerOverlayIn_150ms_ease-out_forwards]",
                        "data-[state=closed]:[animation:drawerOverlayOut_150ms_ease-in_forwards]"
                    )}
                />

                {/* Drawer */}
                <Dialog.Content
                    className={cn(
                        "fixed left-0 top-0 z-50 h-dvh w-[86vw] max-w-[320px] border-r bg-sidebar text-sidebar-foreground shadow-lg outline-none",
                        "data-[state=open]:[animation:drawerSlideInLeft_180ms_ease-out_forwards]",
                        "data-[state=closed]:[animation:drawerSlideOutLeft_180ms_ease-in_forwards]"
                    )}
                >
                    <VisuallyHidden>
                        <Dialog.Title>{title} Navigation</Dialog.Title>
                    </VisuallyHidden>
                    <div className="p-4 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <img alt="Logo" className="h-10 w-10" src={logoSrc} />
                                <div className="min-w-0">
                                    <div className="font-semibold leading-tight truncate">{title}</div>
                                    <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                                </div>
                            </div>

                            <Dialog.Close asChild>
                                <Button variant="ghost" size="icon" aria-label="Close menu">
                                    <X className="h-4 w-4" />
                                </Button>
                            </Dialog.Close>
                        </div>

                        {/*<nav className="space-y-3">
                            {groups?.length ? (
                                groups.map((g) => (
                                    <div key={g.label} className="space-y-1">
                                         Dashboard shown as single item, others as headings
                                        {g.label !== "Dashboard" ? (
                                            <div className="px-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                                {g.label}
                                            </div>
                                        ) : null}

                                        <div className="space-y-1">
                                            {g.items.map(renderItem)}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="space-y-1">{(items ?? []).map(renderItem)}</div>
                            )}
                        </nav>*/}

                        <nav className="space-y-1">
                            {groups?.length ? (
                                groups.map((g) => {
                                    const isSingle = g.items.length === 1
                                    const singleItem = isSingle ? g.items[0] : null
                                    const expandable = !isSingle
                                    const openG = !!openGroups[g.label]
                                    const activeG = g.items.some((it) => isActive(it.to))

                                    if (!expandable && singleItem) {
                                        // Dashboard/Settings tampil seperti item biasa
                                        return (
                                            <button
                                                key={g.label}
                                                type="button"
                                                onClick={() => go(singleItem.to)}
                                                className={cn(
                                                    "w-full text-left block rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                                                    isActive(singleItem.to) ? "bg-sidebar-accent font-medium" : ""
                                                )}
                                            >
                                                {g.label}
                                            </button>
                                        )
                                    }

                                    return (
                                        <div key={g.label} className="space-y-1">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setOpenGroups((prev) => ({ ...prev, [g.label]: !openG }))
                                                }
                                                className={cn(
                                                    "w-full flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors hover:bg-sidebar-accent",
                                                    activeG ? "bg-sidebar-accent/60 font-medium" : ""
                                                )}
                                            >
                                                <span>{g.label}</span>
                                                {openG ? (
                                                    <ChevronDown className="h-4 w-4" />
                                                ) : (
                                                    <ChevronRight className="h-4 w-4" />
                                                )}
                                            </button>

                                            {openG ? (
                                                <div className="pl-3 space-y-1">
                                                    {g.items.map(renderItem)}
                                                </div>
                                            ) : null}
                                        </div>
                                    )
                                })
                            ) : (
                                <div className="space-y-1">{(items ?? []).map(renderItem)}</div>
                            )}
                        </nav>


                        <div className="pt-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
                                onClick={() => {
                                    setOpen(false)
                                    onLogout?.()
                                }}
                            >
                                <LogOut className="h-4 w-4" />
                                Logout
                            </Button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}


/*
import * as React from "react"
import * as Dialog from "@radix-ui/react-dialog"
import { useLocation, useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Menu, X, LogOut } from "lucide-react"
import {VisuallyHidden} from "@radix-ui/react-visually-hidden";

export type NavItem = {
    label: string
    to: string
}

type Props = {
    logoSrc?: string
    title?: string
    subtitle?: string
    items: NavItem[]
    onLogout?: () => void
}

export function MobileNavDrawer({
                                    logoSrc = "/logo_pontianak.png",
                                    title = "Admin Absensi",
                                    subtitle = "Polresta Pontianak Kota",
                                    items,
                                    onLogout,
                                }: Props) {
    const [open, setOpen] = React.useState(false)
    const location = useLocation()
    const navigate = useNavigate()

    const go = (to: string) => {
        navigate(to)
        setOpen(false)
    }

    const isActive = (to: string) => location.pathname === to || location.pathname.startsWith(to + "/")

    return (
        <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
                <Button variant="outline" size="icon" className="md:hidden" aria-label="Open menu">
                    <Menu className="h-4 w-4" />
                </Button>
            </Dialog.Trigger>

            <Dialog.Portal>
                {/!* Overlay *!/}
                <Dialog.Overlay
                    className={cn(
                        "fixed inset-0 z-50 bg-black/50",
                        "data-[state=open]:[animation:drawerOverlayIn_150ms_ease-out_forwards]",
                        "data-[state=closed]:[animation:drawerOverlayOut_150ms_ease-in_forwards]"
                    )}
                />

                {/!* Drawer *!/}
                <Dialog.Content
                    className={cn(
                        "fixed left-0 top-0 z-50 h-dvh w-[86vw] max-w-[320px] border-r bg-sidebar text-sidebar-foreground shadow-lg outline-none",
                        "data-[state=open]:[animation:drawerSlideInLeft_180ms_ease-out_forwards]",
                        "data-[state=closed]:[animation:drawerSlideOutLeft_180ms_ease-in_forwards]"
                    )}
                >
                    <VisuallyHidden>
                        <Dialog.Title>{title} Navigation</Dialog.Title>
                    </VisuallyHidden>
                    <div className="p-4 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <img alt="Logo" className="h-10 w-10" src={logoSrc} />
                                <div className="min-w-0">
                                    <div className="font-semibold leading-tight truncate">{title}</div>
                                    <div className="text-xs text-muted-foreground truncate">{subtitle}</div>
                                </div>
                            </div>

                            <Dialog.Close asChild>
                                <Button variant="ghost" size="icon" aria-label="Close menu">
                                    <X className="h-4 w-4" />
                                </Button>
                            </Dialog.Close>
                        </div>

                        <nav className="space-y-1">
                            {items.map((it) => (
                                <button
                                    key={it.to}
                                    type="button"
                                    onClick={() => go(it.to)}
                                    className={cn(
                                        "w-full text-left block rounded-md px-3 py-2 text-sm transition-colors",
                                        "hover:bg-sidebar-accent",
                                        isActive(it.to) ? "bg-sidebar-accent font-medium" : ""
                                    )}
                                >
                                    {it.label}
                                </button>
                            ))}
                        </nav>

                        <div className="pt-2">
                            <Button
                                variant="outline"
                                className="w-full justify-start gap-2"
                                onClick={() => {
                                    setOpen(false)
                                    onLogout?.()
                                }}
                            >
                                <LogOut className="h-4 w-4" />
                                Logout
                            </Button>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    )
}
*/
