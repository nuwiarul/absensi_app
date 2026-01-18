import * as React from "react"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import {
  useBulkUpsertHolidays,
  useDeleteHoliday,
  useHolidays,
  useUpsertHoliday,
} from "@/features/holidays/hooks"
import type { BulkHolidayItem, Holiday, HolidayKind, HolidayScope } from "@/features/holidays/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog"
import { useTimezoneQuery } from "@/features/settings/hooks"

function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function hhmm(v: string | null | undefined) {
  if (!v) return ""
  return v.slice(0, 5)
}

function makeRow(): BulkHolidayItem {
  return {
    holiday_date: ymdLocal(new Date()),
    name: "",
    kind: "HOLIDAY",
    half_day_end: null,
  }
}

export default function HolidaysBulkPage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const { data: satkers = [] } = useSatkers()
  const tzQ = useTimezoneQuery()

  const [scope, setScope] = React.useState<HolidayScope>(() => (role === "SUPERADMIN" ? "NATIONAL" : "SATKER"))
  const [satkerId, setSatkerId] = React.useState<string>(() => {
    if (role === "SATKER_ADMIN") return session?.satkerId ?? ""
    return satkers[0]?.id ?? ""
  })

  // Default filter range: 1 Jan - 31 Dec of the current year (from backend settings timezone).
  const [from, setFrom] = React.useState<string>("")
  const [to, setTo] = React.useState<string>("")

  React.useEffect(() => {
    // Avoid UTC date-shift bugs (e.g. 31 Dec prev year) by using plain YYYY-MM-DD.
    if (from && to) return
    const yearNow = tzQ.data?.data?.current_year ?? new Date().getFullYear()
    setFrom(`${yearNow}-01-01`)
    setTo(`${yearNow}-12-31`)
  }, [tzQ.data, from, to])

  React.useEffect(() => {
    if (role === "SATKER_ADMIN") {
      if (session?.satkerId && satkerId !== session.satkerId) setSatkerId(session.satkerId)
      setScope("SATKER")
      return
    }
    if (!satkerId && satkers.length > 0) setSatkerId(satkers[0].id)
  }, [role, session?.satkerId, satkerId, satkers])

  const listQuery = React.useMemo(() => {
    if (!from || !to) return null
    // Satker roles: backend will force own satker + NATIONAL
    if (role !== "SUPERADMIN") {
      return { from, to }
    }
    // SUPERADMIN:
    if (scope === "SATKER") {
      if (!satkerId) return null
      return { scope, satker_id: satkerId, from, to }
    }
    return { scope, from, to }
  }, [role, scope, satkerId, from, to])

  const holidaysQ = useHolidays(listQuery as any)
  const upsertOne = useUpsertHoliday()
  const delOne = useDeleteHoliday()

  // Bulk editor
  const [items, setItems] = React.useState<BulkHolidayItem[]>([makeRow()])
  const bulk = useBulkUpsertHolidays()

  const setItem = (idx: number, patch: Partial<BulkHolidayItem>) => {
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }
  const removeRow = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx))
  const addRow = () => setItems((p) => [...p, makeRow()])

  const submitBulk = async () => {
    const clean = items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.holiday_date && it.name)

    if (clean.length === 0) {
      toast.error("Minimal 1 baris (tanggal + nama) wajib diisi")
      return
    }

    if (role !== "SUPERADMIN") {
      // satker role: scope must be SATKER (backend will accept SATKER with satker_id own)
      if (!session?.satkerId) {
        toast.error("Satker tidak valid")
        return
      }
    }

    if (role === "SUPERADMIN") {
      if (scope === "SATKER" && !satkerId) {
        toast.error("Satker wajib dipilih")
        return
      }
    }

    try {
      const affected = await bulk.mutateAsync({
        scope: role === "SUPERADMIN" ? scope : "SATKER",
        satker_id: role === "SUPERADMIN" ? (scope === "SATKER" ? satkerId : null) : session?.satkerId ?? null,
        items: clean.map((it) => ({
          holiday_date: it.holiday_date,
          name: it.name,
          kind: it.kind ?? "HOLIDAY",
          half_day_end: (it.kind ?? "HOLIDAY") === "HALF_DAY" ? (it.half_day_end ?? null) : null,
        })),
      })
      toast.success(`Holiday tersimpan: ${affected} rows`)
      holidaysQ.refetch()
      // Clear bulk rows after success so the card doesn't keep old inputs (avoid user confusion)
      setItems([])
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal submit holidays")
    }
  }

  // Single edit dialog
  const [openEdit, setOpenEdit] = React.useState(false)
  const [editing, setEditing] = React.useState<Holiday | null>(null)
  const [editForm, setEditForm] = React.useState<{ holiday_date: string; name: string; kind: HolidayKind; half_day_end: string | null }>(
    {
      holiday_date: ymdLocal(new Date()),
      name: "",
      kind: "HOLIDAY",
      half_day_end: null,
    },
  )

  const openNew = () => {
    setEditing(null)
    setEditForm({ holiday_date: ymdLocal(new Date()), name: "", kind: "HOLIDAY", half_day_end: null })
    setOpenEdit(true)
  }

  const openEditRow = (h: Holiday) => {
    setEditing(h)
    setEditForm({
      holiday_date: h.holiday_date,
      name: h.name,
      kind: h.kind,
      half_day_end: h.half_day_end ? hhmm(h.half_day_end) : null,
    })
    setOpenEdit(true)
  }

  const submitOne = async () => {
    if (!editForm.holiday_date || !editForm.name.trim()) {
      toast.error("Tanggal dan nama wajib diisi")
      return
    }
    try {
      const resolvedScope: HolidayScope = role === "SUPERADMIN" ? scope : "SATKER"
      const resolvedSatkerId =
        resolvedScope === "SATKER" ? (role === "SUPERADMIN" ? satkerId : session?.satkerId ?? "") : null
      if (resolvedScope === "SATKER" && !resolvedSatkerId) {
        toast.error("Satker wajib dipilih")
        return
      }
      await upsertOne.mutateAsync({
        scope: resolvedScope,
        satker_id: resolvedScope === "SATKER" ? resolvedSatkerId : null,
        holiday_date: editForm.holiday_date,
        name: editForm.name.trim(),
        kind: editForm.kind,
        half_day_end: editForm.kind === "HALF_DAY" ? (editForm.half_day_end ?? "12:00") : null,
      })
      toast.success(editing ? "Holiday diupdate" : "Holiday ditambahkan")
      setOpenEdit(false)
      holidaysQ.refetch()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal simpan holiday")
    }
  }

  const canEditRow = (h: Holiday) => {
    if (role === "SUPERADMIN") return true
    // SATKER_ADMIN can only edit/delete SATKER scoped rows (cannot touch NATIONAL)
    return h.scope === "SATKER"
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Holidays</h1>
        <p className="text-sm text-muted-foreground">
          Flow: Work Pattern → Holiday → Generate Calendar. NATIONAL berlaku untuk semua satker; SATKER dapat menambah holiday khusus satker.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            {role === "SUPERADMIN" && (
              <div className="space-y-2">
                <Label>Scope</Label>
                <Select value={scope} onValueChange={(v) => setScope(v as HolidayScope)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SATKER">SATKER</SelectItem>
                    <SelectItem value="NATIONAL">NATIONAL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {(role === "SUPERADMIN" ? scope === "SATKER" : true) && (
              <div className="space-y-2">
                <Label>Satker</Label>
                {role === "SUPERADMIN" ? (
                  <div className="w-[340px]">
                    <SatkerSelect value={satkerId} onChange={setSatkerId} items={satkers} />
                  </div>
                ) : (
                  <div className="text-sm pt-2">
                    {session?.satkerCode} - {session?.satkerName}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>

            <div className="flex-1" />
            <Button variant="outline" onClick={openNew}>
              Tambah Holiday
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daftar Holiday</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Tanggal</TableHead>
                  <TableHead className="w-[120px]">Scope</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-[120px]">Kind</TableHead>
                  <TableHead className="w-[140px]">Half Day End</TableHead>
                  <TableHead className="w-[150px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(holidaysQ.data ?? []).map((h) => (
                  <TableRow key={`${h.scope}_${h.satker_id ?? "-"}_${h.holiday_date}`}>
                    <TableCell>{h.holiday_date}</TableCell>
                    <TableCell>{h.scope}</TableCell>
                    <TableCell>{h.name}</TableCell>
                    <TableCell>{h.kind}</TableCell>
                    <TableCell>{h.half_day_end ? hhmm(h.half_day_end) : "-"}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditRow(h)}
                        disabled={!canEditRow(h)}
                      >
                        Edit
                      </Button>
                      <DeleteConfirmDialog
                        title="Hapus holiday?"
                        description={
                          <span className="text-sm">
                            Hapus <b>{h.name}</b> pada tanggal <b>{h.holiday_date}</b> ({h.scope}).
                          </span>
                        }
                        disabled={!canEditRow(h)}
                        loading={delOne.isPending}
                        onConfirm={async () => {
                          try {
                            await delOne.mutateAsync({
                              scope: h.scope,
                              satker_id: h.scope === "SATKER" ? h.satker_id ?? undefined : null,
                              holiday_date: h.holiday_date,
                            })
                            toast.success("Holiday dihapus")
                            holidaysQ.refetch()
                          } catch (e: any) {
                            toast.error(e?.response?.data?.message ?? "Gagal hapus holiday")
                          }
                        }}
                        trigger={
                          <Button variant="destructive" size="sm" disabled={!canEditRow(h)}>
                            Hapus
                          </Button>
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {holidaysQ.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!holidaysQ.isLoading && (holidaysQ.data?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-sm text-muted-foreground">
                      Tidak ada holiday pada range ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Catatan: SATKER_ADMIN tidak bisa mengubah NATIONAL holiday.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bulk Input (opsional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Button variant="outline" onClick={addRow}>
              Tambah Baris
            </Button>
            <Button onClick={submitBulk} disabled={bulk.isPending}>
              Submit Bulk
            </Button>
          </div>

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Tanggal</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-[140px]">Kind</TableHead>
                  <TableHead className="w-[150px]">Half Day End</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input type="date" value={it.holiday_date} onChange={(e) => setItem(idx, { holiday_date: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input placeholder="Nama hari/libur" value={it.name} onChange={(e) => setItem(idx, { name: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={(it.kind ?? "HOLIDAY") as HolidayKind}
                        onValueChange={(v) =>
                          setItem(idx, {
                            kind: v as HolidayKind,
                            half_day_end: v === "HALF_DAY" ? (it.half_day_end ?? "12:00") : null,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOLIDAY">HOLIDAY</SelectItem>
                          <SelectItem value="HALF_DAY">HALF_DAY</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        disabled={(it.kind ?? "HOLIDAY") !== "HALF_DAY"}
                        value={it.half_day_end ?? ""}
                        onChange={(e) => setItem(idx, { half_day_end: e.target.value || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" onClick={() => removeRow(idx)}>
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}

                {items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Belum ada baris. Klik <b>Tambah Baris</b> untuk input bulk.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: Setelah submit bulk, list akan otomatis muncul sesuai filter range.
          </p>
        </CardContent>
      </Card>

      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Holiday" : "Tambah Holiday"}</DialogTitle>
            <DialogDescription>
              {role === "SUPERADMIN" ? (
                scope === "NATIONAL" ? (
                  <span>NATIONAL berlaku untuk semua satker.</span>
                ) : (
                  <span>Holiday khusus satker (SATKER).</span>
                )
              ) : (
                <span>Holiday khusus satker.</span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
              <Label>Tanggal</Label>
              <Input
                type="date"
                value={editForm.holiday_date}
                // tanggal adalah bagian dari key (scope+satker+date). Untuk edit, kunci tanggal.
                disabled={!!editing}
                onChange={(e) => setEditForm((s) => ({ ...s, holiday_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nama</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((s) => ({ ...s, name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kind</Label>
                <Select
                  value={editForm.kind}
                  onValueChange={(v) =>
                    setEditForm((s) => ({
                      ...s,
                      kind: v as HolidayKind,
                      half_day_end: v === "HALF_DAY" ? (s.half_day_end ?? "12:00") : null,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HOLIDAY">HOLIDAY</SelectItem>
                    <SelectItem value="HALF_DAY">HALF_DAY</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Half Day End</Label>
                <Input
                  type="time"
                  disabled={editForm.kind !== "HALF_DAY"}
                  value={editForm.half_day_end ?? ""}
                  onChange={(e) => setEditForm((s) => ({ ...s, half_day_end: e.target.value || null }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>
              Batal
            </Button>
            <Button onClick={submitOne} disabled={upsertOne.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
