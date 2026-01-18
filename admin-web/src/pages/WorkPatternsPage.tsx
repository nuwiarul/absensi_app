import * as React from "react"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useUpsertWorkPattern, useWorkPatterns, useDeleteWorkPattern } from "@/features/work-patterns/hooks"
import type { SatkerWorkPattern, UpsertWorkPatternReq } from "@/features/work-patterns/types"
import { Button } from "@/components/ui/button"
import { ConfirmDialog } from "@/components/ConfirmDialog"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type WeekKey = "mon_work" | "tue_work" | "wed_work" | "thu_work" | "fri_work" | "sat_work" | "sun_work"

const WEEK: { key: WeekKey; label: string }[] = [
  { key: "mon_work", label: "Sen" },
  { key: "tue_work", label: "Sel" },
  { key: "wed_work", label: "Rab" },
  { key: "thu_work", label: "Kam" },
  { key: "fri_work", label: "Jum" },
  { key: "sat_work", label: "Sab" },
  { key: "sun_work", label: "Min" },
]

function hhmm(v: string | null | undefined) {
  if (!v) return ""
  // backend biasanya "HH:MM:SS"
  return v.slice(0, 5)
}

function normalizeTimeInput(v: string) {
  // kirim "HH:MM" ke backend (backend accept HH:MM atau HH:MM:SS)
  return v.length === 5 ? v : v.slice(0, 5)
}

export default function WorkPatternsPage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"

  const { data: satkers = [] } = useSatkers()

  const [satkerId, setSatkerId] = React.useState<string>(() => {
    if (role === "SATKER_ADMIN") return session?.satkerId ?? ""
    return ""
  })

  React.useEffect(() => {
    if (role === "SATKER_ADMIN") {
      if (session?.satkerId && satkerId !== session.satkerId) setSatkerId(session.satkerId)
      return
    }
    // SUPERADMIN: default pilih satker pertama
    if (!satkerId && satkers.length > 0) setSatkerId(satkers[0].id)
  }, [role, session?.satkerId, satkerId, satkers])

  const q = useWorkPatterns(satkerId || null)
  const upsert = useUpsertWorkPattern()
  const del = useDeleteWorkPattern()

  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<SatkerWorkPattern | null>(null)

  const [form, setForm] = React.useState<UpsertWorkPatternReq>(() => ({
    effective_from: "",
    mon_work: true,
    tue_work: true,
    wed_work: true,
    thu_work: true,
    fri_work: true,
    sat_work: false,
    sun_work: false,
    work_start: "08:00",
    work_end: "16:00",
    half_day_end: null,
  }))

  const openCreate = () => {
    setEditing(null)
    setForm({
      effective_from: new Date().toISOString().slice(0, 10),
      mon_work: true,
      tue_work: true,
      wed_work: true,
      thu_work: true,
      fri_work: true,
      sat_work: false,
      sun_work: false,
      work_start: "08:00",
      work_end: "16:00",
      half_day_end: null,
    })
    setOpen(true)
  }

  const openEdit = (p: SatkerWorkPattern) => {
    setEditing(p)
    setForm({
      effective_from: p.effective_from,
      mon_work: p.mon_work,
      tue_work: p.tue_work,
      wed_work: p.wed_work,
      thu_work: p.thu_work,
      fri_work: p.fri_work,
      sat_work: p.sat_work,
      sun_work: p.sun_work,
      work_start: hhmm(p.work_start),
      work_end: hhmm(p.work_end),
      half_day_end: p.half_day_end ? hhmm(p.half_day_end) : null,
    })
    setOpen(true)
  }

  const submit = async () => {
    if (!satkerId) return
    if (!form.effective_from) {
      toast.error("effective_from wajib diisi")
      return
    }
    if (!form.work_start || !form.work_end) {
      toast.error("work_start dan work_end wajib diisi")
      return
    }

    try {
      await upsert.mutateAsync({
        satkerId,
        body: {
          ...form,
          work_start: normalizeTimeInput(form.work_start),
          work_end: normalizeTimeInput(form.work_end),
          half_day_end: form.half_day_end ? normalizeTimeInput(form.half_day_end) : null,
        },
      })
      toast.success(editing ? "Work pattern diupdate" : "Work pattern disimpan")
      setOpen(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal menyimpan")
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Work Patterns</h1>
          <p className="text-sm text-muted-foreground">Atur pola jam kerja per satker (effective from)</p>
        </div>
        <Button onClick={openCreate} disabled={!satkerId}>
          Tambah / Update Pattern
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Satker</CardTitle>
        </CardHeader>
        <CardContent>
          {role === "SUPERADMIN" ? (
            <div className="max-w-xl">
              <SatkerSelect value={satkerId} onChange={setSatkerId} items={satkers} />
            </div>
          ) : (
            <div className="text-sm">
              {session?.satkerCode} - {session?.satkerName}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daftar Pattern</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Effective From</TableHead>
                  <TableHead>Hari Kerja</TableHead>
                  <TableHead>Jam</TableHead>
                  <TableHead>Half Day End</TableHead>
                  <TableHead className="w-[120px]">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(q.data ?? []).map((p) => (
                  <TableRow key={`${p.satker_id}_${p.effective_from}`}>
                    <TableCell>{p.effective_from}</TableCell>
                    <TableCell>
                      {WEEK.filter((w) => p[w.key]).map((w) => w.label).join(", ") || "-"}
                    </TableCell>
                    <TableCell>
                      {hhmm(p.work_start)} - {hhmm(p.work_end)}
                    </TableCell>
                    <TableCell>{p.half_day_end ? hhmm(p.half_day_end) : "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        {(q.data?.length ?? 0) >= 2 ? (
                          <ConfirmDialog
                            trigger={
                              <Button variant="destructive" size="sm">
                                Hapus
                              </Button>
                            }
                            title="Hapus work pattern?"
                            description={
                              <span className="text-sm">
                                Work pattern dengan effective_from <b>{p.effective_from}</b> akan dihapus.
                              </span>
                            }
                            confirmText="Hapus"
                            destructive
                            loading={del.isPending}
                            onConfirm={async () => {
                              try {
                                await del.mutateAsync({ satkerId, effectiveFrom: p.effective_from })
                                toast.success("Work pattern dihapus")
                              } catch (e: any) {
                                toast.error(e?.response?.data?.message ?? "Gagal menghapus")
                              }
                            }}
                          />
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {q.isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!q.isLoading && (q.data?.length ?? 0) === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Belum ada work pattern.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <span />
        </DialogTrigger>
        <DialogContent className="sm:max-w-[680px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Work Pattern" : "Tambah Work Pattern"}</DialogTitle>
            <DialogDescription>
              Upsert: kunci record adalah <b>effective_from</b>. Saat edit, effective_from dikunci.
              Jika ingin mengganti effective_from, buat pattern baru.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Effective From</Label>
              <Input
                type="date"
                disabled={!!editing}
                value={form.effective_from}
                onChange={(e) => setForm((s) => ({ ...s, effective_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Hari Kerja</Label>
              <div className="flex flex-wrap gap-3 rounded-md border p-3">
                {WEEK.map((w) => (
                  <label key={w.key} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={form[w.key]}
                      onChange={(e) => setForm((s) => ({ ...s, [w.key]: e.target.checked }))}
                    />
                    {w.label}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Work Start</Label>
              <Input
                type="time"
                value={form.work_start}
                onChange={(e) => setForm((s) => ({ ...s, work_start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Work End</Label>
              <Input
                type="time"
                value={form.work_end}
                onChange={(e) => setForm((s) => ({ ...s, work_end: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Half Day End (opsional)</Label>
              <Input
                type="time"
                value={form.half_day_end ?? ""}
                onChange={(e) => setForm((s) => ({ ...s, half_day_end: e.target.value || null }))}
              />
              <p className="text-xs text-muted-foreground">Jika diisi, Sabtu bisa jadi HALF_DAY saat generate calendar.</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={submit} disabled={upsert.isPending}>
              Simpan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
