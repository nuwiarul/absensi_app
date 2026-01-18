import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useDeleteUser, useUsers } from "@/features/users/hooks"
import type { User } from "@/features/users/types"
import { cn } from "@/lib/utils"
import { UserFormDialog } from "@/features/users/UserFormDialog"
import { apiErrorMessage } from "@/lib/api-error"
import { getSession } from "@/lib/auth"

export default function UsersPage() {
    // getSession() bisa menghasilkan object baru tiap render, jadi pakai nilai primitif untuk deps.
    const session = getSession()
    const sessionRole = session?.role
    const sessionSatkerId = session?.satkerId ?? ""
    const isSuper = sessionRole === "SUPERADMIN"
    //const { data: users = [], isLoading, isError, error } = useUsers()
    const { data: satkers = [], isLoading: satkerLoading, isError: satkerIsError, error: satkerError } = useSatkers()
    const del = useDeleteUser()

    const [q, setQ] = React.useState("")
    const [satkerFilter, setSatkerFilter] = React.useState<string>(
        isSuper ? "" : sessionSatkerId
    )
    // Radix Select tidak menerima value "" (empty string), jadi pakai sentinel "ALL".
    const [roleFilter, setRoleFilter] = React.useState<string>("ALL")

    React.useEffect(() => {
        if (!isSuper && sessionSatkerId) setSatkerFilter(sessionSatkerId)
    }, [isSuper, sessionSatkerId])

    const { data: users = [], isLoading, isError, error } = useUsers(
        satkerFilter ? satkerFilter : undefined
    )

    const [createOpen, setCreateOpen] = React.useState(false)
    const [editOpen, setEditOpen] = React.useState(false)
    const [editing, setEditing] = React.useState<User | null>(null)

    const filtered = React.useMemo(() => {
        const query = q.trim().toLowerCase()
        return users
            .filter((u) => (satkerFilter ? u.satker?.id === satkerFilter : true))
            .filter((u) => (roleFilter !== "ALL" ? u.role === roleFilter : true))
            .filter((u) => {
                if (!query) return true
                const hay =
                    `${u.nrp} ${u.full_name} ${u.email} ${u.role} ${u.satker?.code ?? ""} ${u.satker?.name ?? ""}`.toLowerCase()
                return hay.includes(query)
            })
    }, [users, q, satkerFilter, roleFilter])

    React.useEffect(() => {
        if (isError && error) {
            toast.error(apiErrorMessage(error, { title: "Gagal memuat user" }))
        }
    }, [isError, error])

    React.useEffect(() => {
        if (satkerIsError && satkerError) {
            toast.error(apiErrorMessage(satkerError, { title: "Gagal memuat satker" }))
        }
    }, [satkerIsError, satkerError])

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>User</CardTitle>
                <Button onClick={() => setCreateOpen(true)}>+ Tambah User</Button>
            </CardHeader>

            <CardContent className="space-y-4">
                {/* Search di atas */}
                <Input
                    placeholder="Cari user (nrp/nama/email/satker/role)..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />

                {/* Semua filter di bawah */}
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="flex w-full items-center gap-2 md:w-[260px]">
                        <Select value={roleFilter} onValueChange={(v) => setRoleFilter(v)}>
                            <SelectTrigger className="w-full">
                                <SelectValue placeholder="Filter role (opsional)" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ALL">Semua role</SelectItem>
                                <SelectItem value="SUPERADMIN">SUPERADMIN</SelectItem>
                                <SelectItem value="SATKER_ADMIN">SATKER_ADMIN</SelectItem>
                                <SelectItem value="SATKER_HEAD">SATKER_HEAD</SelectItem>
                                <SelectItem value="MEMBER">MEMBER</SelectItem>
                            </SelectContent>
                        </Select>

                        {roleFilter !== "ALL" ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-9 px-2"
                                onClick={() => setRoleFilter("ALL")}
                            >
                                Reset
                            </Button>
                        ) : null}
                    </div>

                    {isSuper ? (
                        <div className="flex w-full flex-1 items-center gap-2">
                            <div className="flex-1 min-w-[260px]">
                                <SatkerSelect
                                    value={satkerFilter || undefined}
                                    onChange={(v) => setSatkerFilter(v)}
                                    items={satkers.filter((s) => s.is_active)}
                                    placeholder={satkerLoading ? "Memuat satker..." : "Filter satker (opsional)"}
                                    disabled={satkerLoading || !isSuper}
                                />
                            </div>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setSatkerFilter("")}
                                disabled={satkerLoading || !satkerFilter}
                                className="shrink-0"
                            >
                                Semua
                            </Button>

                            {satkerFilter ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 px-2"
                                    onClick={() => setSatkerFilter("")}
                                >
                                    Reset
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </div>

                <div className="relative w-full overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>NRP</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead>Email</TableHead>
                                <TableHead>Satker</TableHead>
                                <TableHead>Role</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                                        Memuat...
                                    </TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                                        Tidak ada data
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((u) => (
                                    <TableRow key={u.id}>
                                        <TableCell className="font-medium">{u.nrp}</TableCell>
                                        <TableCell>{u.full_name}</TableCell>
                                        <TableCell className="truncate max-w-[240px]">{u.email}</TableCell>
                                        <TableCell>
                                            {u.satker?.code} - {u.satker?.name}
                                        </TableCell>
                                        <TableCell>{u.role}</TableCell>
                                        <TableCell>
                      <span
                          className={cn(
                              "inline-flex items-center rounded-full px-2 py-0.5 text-xs",
                              u.is_active ? "bg-muted" : "bg-destructive/10 text-red-600"
                          )}
                      >
                        {u.is_active ? "Aktif" : "Nonaktif"}
                      </span>
                                        </TableCell>

                                        <TableCell className="text-right space-x-2 whitespace-nowrap">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    setEditing(u)
                                                    setEditOpen(true)
                                                }}
                                            >
                                                Edit
                                            </Button>

                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="destructive" size="sm" disabled={del.isPending}>
                                                        Hapus
                                                    </Button>
                                                </AlertDialogTrigger>

                                                <AlertDialogContent>
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle>Hapus User?</AlertDialogTitle>
                                                        <AlertDialogDescription>
                                                            User <b>{u.full_name}</b> ({u.nrp}) akan dihapus. Tindakan ini tidak dapat dibatalkan.
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>

                                                    <AlertDialogFooter>
                                                        <AlertDialogCancel>Batal</AlertDialogCancel>
                                                        <AlertDialogAction
                                                            onClick={async () => {
                                                                try {
                                                                    await del.mutateAsync(u.id)
                                                                } catch (err: unknown) {
                                                                    toast.error(apiErrorMessage(err, { title: "Gagal menghapus user" }))
                                                                }
                                                            }}
                                                        >
                                                            Ya, hapus
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            <UserFormDialog mode="create" open={createOpen} onOpenChange={setCreateOpen} />

            <UserFormDialog
                mode="edit"
                user={editing ?? undefined}
                open={editOpen}
                onOpenChange={(v) => {
                    setEditOpen(v)
                    if (!v) setEditing(null)
                }}
            />
        </Card>
    )
}
