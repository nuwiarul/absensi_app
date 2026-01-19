import * as React from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

import { apiErrorMessage } from "@/lib/api-error"
import { getSession } from "@/lib/auth"
import { useCreateRank, useDeleteRank, useRanks, useUpdateRank } from "@/features/ranks/hooks"
import type { Rank } from "@/features/ranks/types"

function RankFormDialog(props: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: "create" | "edit"
  rank?: Rank | null
}) {
  const { open, onOpenChange, mode, rank } = props
  const isEdit = mode === "edit"

  const createMut = useCreateRank()
  const updateMut = useUpdateRank()
  const busy = createMut.isPending || updateMut.isPending

  const [code, setCode] = React.useState("")
  const [name, setName] = React.useState("")
  const [description, setDescription] = React.useState<string>("")
  const [tukinBase, setTukinBase] = React.useState<string>("0")

  React.useEffect(() => {
    if (!open) return
    if (isEdit && rank) {
      setCode(rank.code)
      setName(rank.name)
      setDescription(rank.description ?? "")
      setTukinBase(String(rank.tukin_base ?? 0))
    } else {
      setCode("")
      setName("")
      setDescription("")
      setTukinBase("0")
    }
  }, [open, isEdit, rank])

  const submit = async () => {
    try {
      if (!code.trim()) return toast.error("Code wajib")
      if (!name.trim()) return toast.error("Nama wajib")

      const payload = {
        code: code.trim(),
        name: name.trim(),
        description: description.trim() ? description.trim() : null,
        tukin_base: Number.isFinite(Number(tukinBase)) ? Number(tukinBase) : 0,
      }

      if (!isEdit) {
        await createMut.mutateAsync(payload)
        onOpenChange(false)
        return
      }

      if (!rank) return toast.error("Data tidak ditemukan")
      await updateMut.mutateAsync({ id: rank.id, body: payload })
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Pangkat/Golongan" : "Tambah Pangkat/Golongan"}</DialogTitle>
          <DialogDescription>
            Pangkat/Golongan dipakai untuk perhitungan Tukin. Disarankan isi master data ini terlebih dahulu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label>Code</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} disabled={busy} placeholder="Contoh: III/a" />
          </div>
          <div className="space-y-1">
            <Label>Nama</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} placeholder="Contoh: Penata Muda" />
          </div>
          <div className="space-y-1">
            <Label>Deskripsi (opsional)</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} disabled={busy} placeholder="Opsional" />
          </div>
          <div className="space-y-1">
            <Label>Tukin Base (opsional)</Label>
            <Input value={tukinBase} onChange={(e) => setTukinBase(e.target.value)} disabled={busy} inputMode="numeric" />
            <p className="text-xs text-muted-foreground">Boleh 0. Nantinya aturan Tukin bisa menimpa nilai ini.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Batal
          </Button>
          <Button onClick={submit} disabled={busy}>
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function RanksPage() {
  const session = getSession()
  const isSuper = session?.role === "SUPERADMIN"

  const { data: ranks = [], isLoading, isError, error } = useRanks()
  const del = useDeleteRank()

  const [q, setQ] = React.useState("")
  const [createOpen, setCreateOpen] = React.useState(false)
  const [editOpen, setEditOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Rank | null>(null)

  React.useEffect(() => {
    if (isError && error) toast.error(apiErrorMessage(error, { title: "Gagal memuat pangkat/golongan" }))
  }, [isError, error])

  const filtered = React.useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return ranks
    return ranks.filter((r) => `${r.code} ${r.name} ${r.description ?? ""}`.toLowerCase().includes(query))
  }, [ranks, q])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Pangkat / Golongan</CardTitle>
        {isSuper ? <Button onClick={() => setCreateOpen(true)}>+ Tambah</Button> : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <Input placeholder="Cari (code/nama)..." value={q} onChange={(e) => setQ(e.target.value)} />

        {!isSuper ? (
          <div className="rounded-md border p-3 text-sm">
            Anda hanya bisa melihat data pangkat/golongan. Perubahan hanya untuk SUPERADMIN.
          </div>
        ) : null}

        <div className="relative w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead className="text-right">Tukin Base</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="max-w-[360px] truncate">{r.description ?? "-"}</TableCell>
                    <TableCell className="text-right">{r.tukin_base}</TableCell>
                    <TableCell className="text-right space-x-2 whitespace-nowrap">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={!isSuper}
                        onClick={() => {
                          setEditing(r)
                          setEditOpen(true)
                        }}
                      >
                        Edit
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" disabled={!isSuper || del.isPending}>
                            Hapus
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus pangkat/golongan?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Rank yang sedang dipakai user akan menjadi kosong (rank_id NULL) jika dihapus.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={async () => {
                                try {
                                  await del.mutateAsync(r.id)
                                } catch (e: unknown) {
                                  toast.error(apiErrorMessage(e))
                                }
                              }}
                            >
                              Hapus
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

      <RankFormDialog open={createOpen} onOpenChange={setCreateOpen} mode="create" />
      <RankFormDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" rank={editing} />
    </Card>
  )
}
