import {useMemo, useState} from "react"
import {Button} from "@/components/ui/button"
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Input} from "@/components/ui/input"
import {Table, TableBody, TableCell, TableHead, TableHeader, TableRow} from "@/components/ui/table"
import {Dialog, DialogContent, DialogHeader, DialogTitle} from "@/components/ui/dialog"
import {Label} from "@/components/ui/label"
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog"

import {useCreateSatker, useDeleteSatker, useSatkers, useUpdateSatker} from "@/features/satkers/hooks"
import type {Satker} from "@/features/satkers/types"
import {getSession} from "@/lib/auth"

function SatkerForm({
                        initial,
                        onSubmit,
                        loading,
                    }: {
    initial?: { code: string; name: string }
    onSubmit: (v: { code: string; name: string }) => void
    loading: boolean
}) {
    const [code, setCode] = useState(initial?.code ?? "")
    const [name, setName] = useState(initial?.name ?? "")
    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>Kode</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="KODE SATKER"/>
            </div>
            <div className="space-y-2">
                <Label>Nama</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="NAMA SATKER"/>
            </div>
            <Button
                className="w-full"
                disabled={loading}
                onClick={() => onSubmit({code: code.trim(), name: name.trim()})}
            >
                {loading ? "Saving..." : "Simpan"}
            </Button>
        </div>
    )
}

export default function SatkersPage() {
    const s = getSession()
    const isSuper = s?.role === "SUPERADMIN"
    const [q, setQ] = useState("")
    const [openCreate, setOpenCreate] = useState(false)
    const [openEditId, setOpenEditId] = useState<string | null>(null)

    const satkersQ = useSatkers()
    const createM = useCreateSatker()
    const updateM = useUpdateSatker()
    const deleteM = useDeleteSatker()

    const filtered = useMemo(() => {
        const rows = satkersQ.data ?? []
        const s = q.trim().toLowerCase()
        if (!s) return rows
        return rows.filter((x) => (x.code + " " + x.name).toLowerCase().includes(s))
    }, [satkersQ.data, q])

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-4">
                <CardTitle>Satker</CardTitle>

                {isSuper ? <Dialog open={openCreate} onOpenChange={setOpenCreate}>
                    <Button onClick={() => setOpenCreate(true)}>+ Tambah Satker</Button>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Buat Satker</DialogTitle>
                        </DialogHeader>
                        <SatkerForm
                            loading={createM.isPending}
                            onSubmit={async (v) => {
                                // pakai mutateAsync supaya bisa await sukses
                                await createM.mutateAsync(v)
                                setOpenCreate(false)
                            }}
                        />
                    </DialogContent>
                </Dialog> : null}
            </CardHeader>

            <CardContent className="space-y-4">
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari satker..."/>

                {satkersQ.isLoading ? (
                    <div>Loading...</div>
                ) : satkersQ.isError ? (
                    <div className="text-red-600">Gagal load satker</div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Kode</TableHead>
                                <TableHead>Nama</TableHead>
                                <TableHead className="text-right">Aksi</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtered.map((s: Satker) => (
                                <TableRow key={s.id}>
                                    <TableCell className="font-medium">{s.code}</TableCell>
                                    <TableCell>{s.name}</TableCell>
                                    <TableCell className="text-right space-x-2">
                                        {isSuper ? (<><Dialog open={openEditId === s.id}
                                                              onOpenChange={(open) => {
                                                                  if (updateM.isPending) return // optional: lock saat saving
                                                                  if (!open) setOpenEditId(null)
                                                              }}>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={updateM.isPending || deleteM.isPending || createM.isPending}
                                                onClick={() => setOpenEditId(s.id)}>
                                                Edit
                                            </Button>
                                            <DialogContent>
                                                <DialogHeader>
                                                    <DialogTitle>Edit Satker</DialogTitle>
                                                </DialogHeader>
                                                <SatkerForm
                                                    initial={{code: s.code, name: s.name}}
                                                    loading={updateM.isPending}
                                                    onSubmit={async (v) => {
                                                        await updateM.mutateAsync({id: s.id, body: v})
                                                        setOpenEditId(null) // ✅ tutup dialog setelah sukses
                                                    }}
                                                />
                                            </DialogContent>
                                        </Dialog>

                                            <DeleteConfirmDialog
                                                title="Hapus satker?"
                                                description={
                                                    <>
                                                        Satker <b>{s.code}</b> - <b>{s.name}</b> akan dihapus permanen.
                                                        Tindakan ini tidak bisa dibatalkan.
                                                    </>
                                                }
                                                loading={deleteM.isPending}
                                                disabled={updateM.isPending || createM.isPending}
                                                confirmText="Ya, Hapus"
                                                onConfirm={() => deleteM.mutate(s.id)}
                                                trigger={
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        disabled={deleteM.isPending || updateM.isPending || createM.isPending}
                                                    >
                                                        Hapus
                                                    </Button>
                                                }
                                            /> </>) : (
                                            <span className="text-xs text-muted-foreground">-</span>
                                        )}

                                    </TableCell>
                                </TableRow>
                            ))}
                            {filtered.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                                        Tidak ada data
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
