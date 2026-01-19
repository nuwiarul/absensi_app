import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { getSession } from "@/lib/auth"
import { cn } from "@/lib/utils"

import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useCalendarDays } from "@/features/calendar/hooks"
import type { CalendarDay } from "@/features/calendar/types"
import { useUpsertWorkingDay } from "@/features/working-days/hooks"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function lastOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function toMonthValue(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  return `${y}-${m}`
}

function hhmm(v: string | null | undefined) {
  if (!v) return ""
  return v.slice(0, 5)
}

export default function CalendarResultPage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const { data: satkers = [] } = useSatkers()

  const [params, setParams] = useSearchParams()
  const [satkerId, setSatkerId] = React.useState<string>(() => {
    if (role === "SATKER_ADMIN") return session?.satkerId ?? ""
    return params.get("satkerId") ?? ""
  })
  const [from, setFrom] = React.useState<string>(() => {
    const v = params.get("from")
    if (v) return v
    const now = new Date()
    return ymdLocal(firstOfMonth(now))
  })
  const [to, setTo] = React.useState<string>(() => {
    const v = params.get("to")
    if (v) return v
    const now = new Date()
    return ymdLocal(lastOfMonth(now))
  })

  const [month, setMonth] = React.useState<string>(() => {
    const now = new Date()
    return toMonthValue(now)
  })

  // jika URL ada from/to, set month mengikuti from
  React.useEffect(() => {
    const y = parseInt(from.slice(0, 4), 10)
    const m = parseInt(from.slice(5, 7), 10) - 1
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      setMonth(`${y}-${String(m + 1).padStart(2, "0")}`)
    }
  }, [from])

  React.useEffect(() => {
    if (role === "SATKER_ADMIN") {
      if (session?.satkerId && satkerId !== session.satkerId) setSatkerId(session.satkerId)
      return
    }
    if (!satkerId && satkers.length > 0) setSatkerId(satkers[0].id)
  }, [role, session?.satkerId, satkerId, satkers])

  const query = React.useMemo(() => {
    if (!satkerId || !from || !to) return null
    return { satkerId, from, to }
  }, [satkerId, from, to])

  const q = useCalendarDays(query)
  const upsert = useUpsertWorkingDay()

  const applyToUrl = () => {
    if (!satkerId || !from || !to) {
      toast.error("satker/from/to wajib")
      return
    }
    setParams({ satkerId, from, to })
  }

  const rows: CalendarDay[] = q.data ?? []
  const byDate = React.useMemo(() => {
    const m = new Map<string, CalendarDay>()
    for (const r of rows) m.set(r.work_date, r)
    return m
  }, [rows])

  const monthDate = React.useMemo(() => {
    const y = parseInt(month.slice(0, 4), 10)
    const mo = parseInt(month.slice(5, 7), 10) - 1
    return new Date(y, mo, 1)
  }, [month])

  const grid = React.useMemo(() => {
    const start = firstOfMonth(monthDate)
    const end = lastOfMonth(monthDate)
    const startDow = start.getDay() // 0=Sun
    const daysInMonth = end.getDate()

    // convert to Monday-first index
    const offset = (startDow + 6) % 7
    const cells: Array<{ date: Date | null }> = []
    for (let i = 0; i < offset; i++) cells.push({ date: null })
    for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(start.getFullYear(), start.getMonth(), d) })
    while (cells.length % 7 !== 0) cells.push({ date: null })
    return cells
  }, [monthDate])

  // ---- Edit dialog state ----
  const [editOpen, setEditOpen] = React.useState(false)
  const [editDate, setEditDate] = React.useState<string>("")
  const [editType, setEditType] = React.useState<"WORKDAY" | "HALF_DAY" | "HOLIDAY">("WORKDAY")
  const [editStart, setEditStart] = React.useState<string>("08:00")
  const [editEnd, setEditEnd] = React.useState<string>("16:00")
  const [editNote, setEditNote] = React.useState<string>("")

  const openEdit = (ds: string) => {
    const info = byDate.get(ds)
    setEditDate(ds)
    setEditType((info?.day_type ?? "WORKDAY") as any)
    setEditStart(hhmm(info?.expected_start) || "08:00")
    setEditEnd(hhmm(info?.expected_end) || "16:00")
    setEditNote(info?.note ?? "")
    setEditOpen(true)
  }

  const saveEdit = async () => {
    if (!satkerId || !editDate) return
    try {
      const body: any = {
        day_type: editType,
        note: editNote?.trim() ? editNote.trim() : null,
      }
      if (editType === "HOLIDAY") {
        body.expected_start = null
        body.expected_end = null
      } else {
        body.expected_start = editStart
        body.expected_end = editEnd
      }

      await upsert.mutateAsync({ satkerId, workDate: editDate, body })
      toast.success("Calendar day berhasil diupdate")
      await q.refetch()
      setEditOpen(false)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? e?.message ?? "Gagal update")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Calendar Result</h1>
        <p className="text-sm text-muted-foreground">Lihat hasil generate kalender (satker_calendar_days). Klik tanggal untuk edit.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {role === "SUPERADMIN" ? (
            <div className="max-w-xl space-y-2">
              <Label>Satker</Label>
              <SatkerSelect value={satkerId} onChange={setSatkerId} items={satkers} />
            </div>
          ) : (
            <div className="text-sm">
              <span className="font-medium">Satker: </span>
              {session?.satkerCode} - {session?.satkerName}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Bulan</Label>
              <Input
                type="month"
                value={month}
                onChange={(e) => {
                  const v = e.target.value
                  setMonth(v)
                  const y = parseInt(v.slice(0, 4), 10)
                  const m = parseInt(v.slice(5, 7), 10) - 1
                  const d = new Date(y, m, 1)
                  setFrom(ymdLocal(firstOfMonth(d)))
                  setTo(ymdLocal(lastOfMonth(d)))
                }}
              />
            </div>
            <Button variant="outline" onClick={applyToUrl} disabled={!satkerId || !from || !to}>
              Terapkan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Calendar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-7 gap-2 text-xs">
            {["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"].map((d) => (
              <div key={d} className="px-2 py-1 font-medium text-muted-foreground">
                {d}
              </div>
            ))}

            {grid.map((c, idx) => {
              if (!c.date) return <div key={idx} className="h-16 rounded-md border bg-muted/20" />

              const ds = ymdLocal(c.date)
              const info = byDate.get(ds)
              const type = info?.day_type

              const boxClass =
                type === "HOLIDAY"
                  ? "bg-red-500/15 border-red-500/30"
                  : type === "HALF_DAY"
                    ? "bg-orange-500/15 border-orange-500/30"
                    : ""

              const title = info
                ? `${info.work_date} | ${info.day_type} | ${hhmm(info.expected_start) || "-"}-${hhmm(info.expected_end) || "-"}${info.note ? ` | ${info.note}` : ""}`
                : ds

              return (
                <button
                  key={idx}
                  type="button"
                  className={cn(
                    "h-16 rounded-md border p-2 text-left transition hover:bg-muted/40",
                    boxClass
                  )}
                  title={title}
                  onClick={() => openEdit(ds)}
                  disabled={!satkerId}
                >
                  <div className="flex items-start justify-between">
                    <div className="text-sm font-semibold">{c.date.getDate()}</div>
                    {type ? (
                      <div className="text-[10px] text-muted-foreground">
                        {type === "WORKDAY" ? "WD" : type === "HOLIDAY" ? "H" : "HD"}
                      </div>
                    ) : null}
                  </div>
                  {info?.note ? (
                    <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{info.note}</div>
                  ) : null}
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm border bg-red-500/20" />
              <span>Holiday</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm border bg-orange-500/20" />
              <span>Half day</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm border" />
              <span>Workday</span>
            </div>
          </div>

          {q.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading...</div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-muted-foreground">Belum ada data. Pastikan sudah generate kalender untuk tahun ini (1 tahun penuh).</div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Day: {editDate}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Day type</Label>
              <Select
                value={editType}
                onValueChange={(v) => {
                  setEditType(v as any)
                  if (v === "HOLIDAY") {
                    // times will be ignored by backend for HOLIDAY
                    setEditStart("08:00")
                    setEditEnd("16:00")
                  }
                }}
              >
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

            {editType !== "HOLIDAY" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Expected start</Label>
                  <Input type="time" value={editStart} onChange={(e) => setEditStart(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Expected end</Label>
                  <Input type="time" value={editEnd} onChange={(e) => setEditEnd(e.target.value)} />
                </div>
              </div>
            ) : (
              <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">
                HOLIDAY: jam kerja tidak diperlukan.
              </div>
            )}

            <div className="space-y-2">
              <Label>Note</Label>
              <Textarea value={editNote} onChange={(e) => setEditNote(e.target.value)} placeholder="Opsional" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button onClick={saveEdit} disabled={upsert.isPending || !satkerId || !editDate}>
              {upsert.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
