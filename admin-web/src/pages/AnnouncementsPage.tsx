import * as React from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { getSession } from "@/lib/auth"
import { apiErrorMessage } from "@/lib/api-error"
import { formatTanggalIndonesia } from "@/lib/date"
import { useSatkers } from "@/features/satkers/hooks"
import {
  type Announcement,
  type AnnouncementScope,
  type CreateAnnouncementReq,
  type UpdateAnnouncementReq,
  useCreateAnnouncement,
  useDeleteAnnouncement,
  useManageableAnnouncements,
  useUpdateAnnouncement,
} from "@/features/announcements"

function scopeBadge(scope: AnnouncementScope) {
  if (scope === "GLOBAL") return <Badge>Global</Badge>
  return <Badge variant="secondary">Satker</Badge>
}

export default function AnnouncementsPage() {
  const s = getSession()
  const role = s?.role ?? "SUPERADMIN"
  const isSuperadmin = role === "SUPERADMIN"
  const isSatkerAdmin = role === "SATKER_ADMIN"
  const canCreate = isSuperadmin || isSatkerAdmin

  const q = useManageableAnnouncements(true)
  //const satkersQ = useSatkers(isSuperadmin) // only need list for SUPERADMIN

  const satkersQ = useSatkers() // only need list for SUPERADMIN

  const createM = useCreateAnnouncement()
  const updateM = useUpdateAnnouncement()
  const deleteM = useDeleteAnnouncement()

  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<"create" | "edit">("create")
  const [editing, setEditing] = React.useState<Announcement | null>(null)

  // form
  const [scope, setScope] = React.useState<AnnouncementScope>(isSatkerAdmin ? "SATKER" : "GLOBAL")
  const [satkerId, setSatkerId] = React.useState<string>(isSatkerAdmin ? s?.satkerId ?? "" : "")
  const [title, setTitle] = React.useState("")
  const [body, setBody] = React.useState("")
  const [isActive, setIsActive] = React.useState(true)

  React.useEffect(() => {
    if (isSatkerAdmin) {
      setScope("SATKER")
      setSatkerId(s?.satkerId ?? "")
    }
  }, [isSatkerAdmin, s?.satkerId])

  function resetForm() {
    setMode("create")
    setEditing(null)
    setScope(isSatkerAdmin ? "SATKER" : "GLOBAL")
    setSatkerId(isSatkerAdmin ? s?.satkerId ?? "" : "")
    setTitle("")
    setBody("")
    setIsActive(true)
  }

  function openCreate() {
    resetForm()
    setOpen(true)
  }

  function openEdit(a: Announcement) {
    setMode("edit")
    setEditing(a)
    setScope(a.scope)
    setSatkerId(a.satker_id ?? "")
    setTitle(a.title)
    setBody(a.body)
    setIsActive(a.is_active)
    setOpen(true)
  }

  async function onSubmit() {
    try {
      const t = title.trim()
      const b = body.trim()
      if (!t) return toast.error("Judul wajib diisi")
      if (!b) return toast.error("Isi pengumuman wajib diisi")

      if (mode === "create") {
        const payload: CreateAnnouncementReq = {
          scope,
          satker_id: scope === "SATKER" ? satkerId : null,
          title: t,
          body: b,
          is_active: isActive,
        }
        await createM.mutateAsync(payload)
      } else if (mode === "edit" && editing) {
        const payload: UpdateAnnouncementReq = {
          // SATKER_ADMIN restrictions are enforced by backend; UI also helps
          scope,
          satker_id: scope === "SATKER" ? satkerId : null,
          title: t,
          body: b,
          is_active: isActive,
        }
        await updateM.mutateAsync({ id: editing.id, body: payload })
      }

      setOpen(false)
      resetForm()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  async function onDelete(a: Announcement) {
    if (!confirm(`Hapus pengumuman: ${a.title}?`)) return
    try {
      await deleteM.mutateAsync(a.id)
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  const rows = q.data?.data ?? []

  const satkerOptions = Array.isArray((satkersQ.data as any))
      ? (satkersQ.data as any[])
      : Array.isArray((satkersQ.data as any)?.data)
          ? ((satkersQ.data as any).data as any[])
          : []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Pengumuman</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
              Refresh
            </Button>
            {canCreate && (
              <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm() }}>
                <DialogTrigger asChild>
                  <Button onClick={openCreate}>Buat Pengumuman</Button>
                </DialogTrigger>
                <DialogContent className="max-w-xl">
                  <DialogHeader>
                    <DialogTitle>{mode === "create" ? "Buat Pengumuman" : "Edit Pengumuman"}</DialogTitle>
                    <DialogDescription>
                      Scope Global terlihat oleh semua user. Scope Satker hanya terlihat oleh user pada satker tersebut.
                    </DialogDescription>
                  </DialogHeader>

                  <div className="grid gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm font-medium mb-1">Scope</div>
                        <Select
                          value={scope}
                          onValueChange={(v) => setScope(v as AnnouncementScope)}
                          disabled={isSatkerAdmin}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih scope" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="GLOBAL">GLOBAL</SelectItem>
                            <SelectItem value="SATKER">SATKER</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-1">Aktif</div>
                        <div className="h-10 px-3 border rounded-md flex items-center justify-between">
                          <div className="text-sm text-muted-foreground">Tampilkan pengumuman</div>
                          <Switch checked={isActive} onCheckedChange={setIsActive} />
                        </div>
                      </div>
                    </div>

                    {scope === "SATKER" && (
                      <div>
                        <div className="text-sm font-medium mb-1">Satker</div>
                        {/*<Select
                          value={satkerId}
                          onValueChange={setSatkerId}
                          disabled={isSatkerAdmin || !isSuperadmin}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pilih satker" />
                          </SelectTrigger>
                          <SelectContent>
                            {satkerOptions
                                .filter((x) => isSuperadmin || x.id === s?.satkerId)
                                .map((x) => (
                                    <SelectItem key={x.id} value={x.id}>
                                      {x.code} - {x.name}
                                    </SelectItem>
                                ))}
                          </SelectContent>
                        </Select>*/}
                        {isSatkerAdmin ? (
                            <>
                              <Input value={`${s?.satkerCode ?? ""} - ${s?.satkerName ?? ""}`.trim()} readOnly />
                              <div className="text-xs text-muted-foreground mt-1">
                                SATKER_ADMIN hanya bisa membuat pengumuman untuk satker sendiri.
                              </div>
                            </>
                        ) : (
                            <Select value={satkerId} onValueChange={setSatkerId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Pilih satker" />
                              </SelectTrigger>
                              <SelectContent>
                                {satkerOptions.map((x) => (
                                    <SelectItem key={x.id} value={x.id}>
                                      {x.code} - {x.name}
                                    </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                        )}
                      </div>
                    )}

                    <div>
                      <div className="text-sm font-medium mb-1">Judul</div>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pengumuman" />
                    </div>

                    <div>
                      <div className="text-sm font-medium mb-1">Isi</div>
                      <Textarea
                        value={body}
                        onChange={(e) => setBody(e.target.value)}
                        placeholder="Tulis isi pengumuman..."
                        rows={6}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                      Batal
                    </Button>
                    <Button
                      onClick={onSubmit}
                      disabled={createM.isPending || updateM.isPending}
                    >
                      {mode === "create" ? "Simpan" : "Update"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Memuat...</div>
          ) : q.isError ? (
            <div className="text-sm text-destructive">Gagal memuat pengumuman</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Satker</TableHead>
                  <TableHead>Judul</TableHead>
                  <TableHead>Aktif</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      Belum ada pengumuman
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((a) => {
                    const satkerLabel = a.scope === "SATKER" ? `${a.satker_code ?? ""} ${a.satker_name ?? ""}`.trim() : "-"
                    const canEditRow =
                      isSuperadmin ||
                      (isSatkerAdmin && a.scope === "SATKER" && (a.satker_id ?? "") === (s?.satkerId ?? ""))

                    return (
                      <TableRow key={a.id}>
                        <TableCell>{formatTanggalIndonesia(a.created_at)}</TableCell>
                        <TableCell>{scopeBadge(a.scope)}</TableCell>
                        <TableCell>{satkerLabel || "-"}</TableCell>
                        <TableCell className="max-w-[420px]">
                          <div className="font-medium truncate">{a.title}</div>
                          <div className="text-xs text-muted-foreground truncate">{a.body}</div>
                        </TableCell>
                        <TableCell>
                          {a.is_active ? <Badge variant="outline">Aktif</Badge> : <Badge variant="secondary">Nonaktif</Badge>}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openEdit(a)}
                              disabled={!canEditRow}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDelete(a)}
                              disabled={!canEditRow}
                            >
                              Hapus
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
