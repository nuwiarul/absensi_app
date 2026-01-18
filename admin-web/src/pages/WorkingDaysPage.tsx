import * as React from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

import { getSession } from "@/lib/auth"
import { apiErrorMessage } from "@/lib/api-error"

import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useDeleteWorkingDay, useUpsertWorkingDay, useWorkingDays } from "@/features/working-days/hooks"
import type { CalendarDayType, UpsertWorkingDayReq, WorkingDay } from "@/features/working-days/types"

function defaultRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const from = new Date(y, m, 1)
  const to = new Date(y, m + 1, 0)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  return { from: fmt(from), to: fmt(to) }
}

function toTimeHMSS(v: string) {
  if (!v) return ""
  // accept HH:MM or HH:MM:SS
  if (v.length === 5) return `${v}:00`
  return v
}

function WorkingDayForm({
  initial,
  onSubmit,
  loading,
}: {
  initial: {
    work_date: string
    day_type: CalendarDayType
    expected_start: string | null
    expected_end: string | null
    note: string | null
  }
  onSubmit: (body: UpsertWorkingDayReq) => void
  loading: boolean
}) {
  const [dayType, setDayType] = React.useState<CalendarDayType>(initial.day_type)
  const [start, setStart] = React.useState<string>(() => (initial.expected_start ? initial.expected_start.slice(0, 5) : ""))
  const [end, setEnd] = React.useState<string>(() => (initial.expected_end ? initial.expected_end.slice(0, 5) : ""))
  const [note, setNote] = React.useState<string>(initial.note ?? "")

  const needsTime = dayType === "WORKDAY" || dayType === "HALF_DAY"
  const ok = !needsTime || (start.length >= 4 && end.length >= 4)

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tanggal</Label>
        <Input value={initial.work_date} disabled />
      </div>

      <div className="space-y-2">
        <Label>Jenis hari</Label>
        <Select value={dayType} onValueChange={(v) => setDayType(v as CalendarDayType)}>
          <SelectTrigger>
            <SelectValue placeholder="Pilih" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="WORKDAY">WORKDAY</SelectItem>
            <SelectItem value="HALF_DAY">HALF_DAY</SelectItem>
            <SelectItem value="HOLIDAY">HOLIDAY</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Expected start</Label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} disabled={!needsTime} />
        </div>
        <div className="space-y-2">
          <Label>Expected end</Label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} disabled={!needsTime} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Catatan</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opsional" />
      </div>

      <Button
        className="w-full"
        disabled={loading || !ok}
        onClick={() =>
          onSubmit({
            day_type: dayType,
            expected_start: needsTime ? toTimeHMSS(start) : null,
            expected_end: needsTime ? toTimeHMSS(end) : null,
            note: note.trim() ? note.trim() : null,
          })
        }
      >
        {loading ? "Saving..." : "Simpan"}
      </Button>
    </div>
  )
}

export default function WorkingDaysPage() {
  const session = getSession()
  const isSuper = session?.role === "SUPERADMIN"
  const fixedSatkerId = session?.satkerId ?? ""

  const { from: defaultFrom, to: defaultTo } = defaultRange()
  const [from, setFrom] = React.useState(defaultFrom)
  const [to, setTo] = React.useState(defaultTo)

  const satkersQ = useSatkers()
  const satkers = satkersQ.data ?? []

  const [satkerId, setSatkerId] = React.useState<string>(() => (isSuper ? "" : fixedSatkerId))

  React.useEffect(() => {
    if (!session) return
    if (!isSuper) setSatkerId(fixedSatkerId)
  }, [fixedSatkerId, isSuper, session])

  // superadmin: default ke satker pertama biar langsung kebuka
  React.useEffect(() => {
    if (!isSuper) return
    if (satkerId) return
    const first = satkers.find((x) => x.is_active)
    if (first) setSatkerId(first.id)
  }, [isSuper, satkerId, satkers])

  const q = useWorkingDays({ satkerId, from, to })
  const upsertM = useUpsertWorkingDay()
  const deleteM = useDeleteWorkingDay()

  const [openEdit, setOpenEdit] = React.useState(false)
  const [editing, setEditing] = React.useState<WorkingDay | null>(null)

  const rows = q.data ?? []
  const satkerLabel = React.useMemo(() => {
    const s = satkers.find((x) => x.id === satkerId)
    return s ? `${s.code} - ${s.name}` : ""
  }, [satkerId, satkers])

  React.useEffect(() => {
    if (q.isError) {
      toast.error(apiErrorMessage(q.error, { title: "Gagal memuat working days" }))
    }
  }, [q.error, q.isError])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div className="space-y-1">
          <CardTitle>Working Days</CardTitle>
          {satkerLabel ? <div className="text-sm text-muted-foreground">{satkerLabel}</div> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search/Range di atas */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <Label>Dari</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-full sm:w-56">
            <Label>Sampai</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              const r = defaultRange()
              setFrom(r.from)
              setTo(r.to)
            }}
          >
            Bulan ini
          </Button>
        </div>

        {/* Filter satker di bawah (khusus superadmin) */}
        {isSuper && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-80">
              <Label>Satker</Label>
              <SatkerSelect
                value={satkerId}
                onChange={setSatkerId}
                items={satkers.filter((x) => x.is_active)}
                placeholder={satkersQ.isLoading ? "Memuat..." : "Pilih satker"}
                disabled={satkersQ.isLoading}
              />
            </div>
          </div>
        )}

        {q.isLoading || satkersQ.isLoading ? (
          <div>Loading...</div>
        ) : rows.length === 0 ? (
          <div className="text-sm text-muted-foreground">Tidak ada data (cek satker & range)</div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={`${r.satker_id}-${r.work_date}`}>
                    <TableCell className="font-medium">{r.work_date}</TableCell>
                    <TableCell>{r.day_type}</TableCell>
                    <TableCell>{r.expected_start ? r.expected_start.slice(0, 5) : "-"}</TableCell>
                    <TableCell>{r.expected_end ? r.expected_end.slice(0, 5) : "-"}</TableCell>
                    <TableCell className="max-w-[260px] truncate" title={r.note ?? undefined}>
                      {r.note ?? "-"}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditing(r)
                          setOpenEdit(true)
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={deleteM.isPending}
                        onClick={async () => {
                          try {
                            await deleteM.mutateAsync({ satkerId, workDate: r.work_date })
                            toast.success("Working day dihapus")
                          } catch (e) {
                            toast.error(apiErrorMessage(e, { title: "Gagal hapus working day" }))
                          }
                        }}
                      >
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Dialog
          open={openEdit}
          onOpenChange={(o) => {
            if (upsertM.isPending) return
            if (!o) {
              setOpenEdit(false)
              setEditing(null)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Working Day</DialogTitle>
            </DialogHeader>

            {editing ? (
              <WorkingDayForm
                initial={editing}
                loading={upsertM.isPending}
                onSubmit={async (body) => {
                  try {
                    await upsertM.mutateAsync({ satkerId, workDate: editing.work_date, body })
                    toast.success("Working day tersimpan")
                    setOpenEdit(false)
                    setEditing(null)
                  } catch (e) {
                    toast.error(apiErrorMessage(e, { title: "Gagal menyimpan" }))
                  }
                }}
              />
            ) : null}

            <DialogFooter />
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
