import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// Dedicated page (SUPERADMIN) - no tabs here
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

import { getSession } from "@/lib/auth"
import { useTimezoneQuery } from "@/features/settings/hooks"
import { listSatkers } from "@/features/satkers/api"
import { useQuery } from "@tanstack/react-query"
import { useUsers } from "@/features/users/hooks"
import { useWorkingDays } from "@/features/working-days/hooks"
import { listGeofences } from "@/features/geofences/api"
import { fetchAttendanceRecap, upsertAttendanceAdmin, deleteAttendanceAdmin } from "@/features/attendance/api"
import type { AttendanceRekapRow } from "@/features/attendance/types"
import type { Geofence } from "@/features/geofences/types"

type LeaveType = "NORMAL" | "DINAS_LUAR" | "WFA" | "WFH" | "IJIN" | "SAKIT"

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "DINAS_LUAR", label: "Dinas Luar" },
  { value: "WFA", label: "WFA" },
  { value: "WFH", label: "WFH" },
  { value: "IJIN", label: "Ijin" },
  { value: "SAKIT", label: "Sakit" },
]

function tzOffset(tz: string): string {
  if (tz === "Asia/Jayapura") return "+09:00"
  if (tz === "Asia/Makassar") return "+08:00"
  return "+07:00" // Asia/Jakarta default
}

function isoFromDateTime(dateYmd: string, timeHm: string, tz: string): string {
  // Send with explicit offset so backend parses to UTC correctly.
  // Example: 2026-01-19T08:15:00+08:00
  return `${dateYmd}T${timeHm}:00${tzOffset(tz)}`
}

function fmtClock(iso: string | null | undefined, tz: string) {
  if (!iso) return "-"
  const d = new Date(iso)
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    timeZone: tz,
  }).format(d).replaceAll(":", ".")
}

function defaultMonthRangeYmd(now: Date, tz: string) {
  // Month range in timezone, but return as YYYY-MM-DD (calendar date)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now)
  const year = parts.find((p) => p.type === "year")!.value
  const month = parts.find((p) => p.type === "month")!.value
  const day = parts.find((p) => p.type === "day")!.value
  // start = 01
  const from = `${year}-${month}-01`
  // end = today (disable future dates in edit attendance)
  const to = `${year}-${month}-${day}`
  return { year: Number(year), month: Number(month), from, to }
}

type EditForm = {
  work_date: string
  check_in_time: string
  check_out_time: string
  in_leave_type: LeaveType
  out_leave_type: LeaveType
  in_leave_notes: string
  out_leave_notes: string
  in_geofence_id: string
  out_geofence_id: string
  device_id: string
  device_model: string
  client_version: string
  manual_note: string
}

const EMPTY_FORM: EditForm = {
  work_date: "",
  check_in_time: "",
  check_out_time: "",
  in_leave_type: "NORMAL",
  out_leave_type: "NORMAL",
  in_leave_notes: "",
  out_leave_notes: "",
  in_geofence_id: "",
  out_geofence_id: "",
  device_id: "",
  device_model: "",
  client_version: "",
  manual_note: "",
}

// shadcn Select.Item cannot have empty string value. We use this sentinel for "no selection".
const NONE_VALUE = "__none__"

export default function AttendanceManagePage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  if (role !== "SUPERADMIN") {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Akses ditolak</CardTitle>
          </CardHeader>
          <CardContent>Hanya SUPERADMIN yang dapat mengedit absensi.</CardContent>
        </Card>
      </div>
    )
  }

  const tzQ = useTimezoneQuery()
  const tz = tzQ.data?.timezone ?? "Asia/Jakarta"

  const init = useMemo(() => defaultMonthRangeYmd(new Date(), tz), [tz])
  const todayYmd = init.to
  const [satkerId, setSatkerId] = useState<string>("")
  const [userId, setUserId] = useState<string>("")
  const [from, setFrom] = useState<string>(init.from)
  const [to, setTo] = useState<string>(init.to)

  // Load satkers for SUPERADMIN
  const satkerQ = useQuery({
    queryKey: ["satkers", "list"],
    queryFn: listSatkers,
  })

  // Reset user when satker changes
  function onSatkerChange(v: string) {
    setSatkerId(v)
    setUserId("")
  }

  const usersQ = useUsers(satkerId || undefined)

  const geosQ = useQuery<Geofence[]>({
    queryKey: ["geofences", "list"],
    queryFn: listGeofences,
  })

  const geoBySatker = useMemo(() => {
    const all = geosQ.data ?? []
    if (!satkerId) return []
    return all.filter((g) => g.satker_id === satkerId)
  }, [geosQ.data, satkerId])

  const recapEnabled = !!userId && !!from && !!to
  const recapQ = useQuery({
    queryKey: ["attendance", "recap", { userId, from, to }],
    queryFn: async () => fetchAttendanceRecap({ user_id: userId, from, to }),
    enabled: recapEnabled,
  })

  const wdsQ = useWorkingDays({ satkerId: satkerId, from, to })

  const rows = useMemo(() => {
    const att = recapQ.data ?? []
    const byDate = new Map(att.map((r) => [r.work_date, r]))
    const wds = wdsQ.data ?? []
    // Show only WORKDAY/HALF_DAY by default
    const dates = wds
      .filter((d) => d.day_type === "WORKDAY" || d.day_type === "HALF_DAY")
      .map((d) => d.work_date)
    // Fallback: if calendar not generated, use attendance dates
    const finalDates = dates.length ? dates : Array.from(byDate.keys()).sort()

    return finalDates.map((d) => byDate.get(d) ?? ({
      session_id: "",
      work_date: d,
      user_id: userId,
      full_name: "",
      nrp: "",
      satker_name: "",
      satker_code: "",
      check_in_at: null,
      check_out_at: null,
    } as unknown as AttendanceRekapRow))
  }, [recapQ.data, wdsQ.data, userId])

  const [dlgOpen, setDlgOpen] = useState(false)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)

  function openForDate(dateYmd: string, row?: AttendanceRekapRow) {
    const base: EditForm = { ...EMPTY_FORM, work_date: dateYmd }
    if (row?.check_in_at) {
      const d = new Date(row.check_in_at)
      base.check_in_time = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d)
      base.in_leave_type = (row.check_in_attendance_leave_type as LeaveType) ?? "NORMAL"
      base.in_leave_notes = row.check_in_attendance_leave_notes ?? ""
      base.in_geofence_id = row.check_in_geofence_id ?? ""
    }
    if (row?.check_out_at) {
      const d = new Date(row.check_out_at)
      base.check_out_time = new Intl.DateTimeFormat("en-GB", {
        timeZone: tz,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d)
      base.out_leave_type = (row.check_out_attendance_leave_type as LeaveType) ?? "NORMAL"
      base.out_leave_notes = row.check_out_attendance_leave_notes ?? ""
      base.out_geofence_id = row.check_out_geofence_id ?? ""
    }

    base.device_id = row?.check_in_device_id ?? row?.check_out_device_id ?? ""
    base.device_model = row?.check_in_device_model ?? row?.check_out_device_model ?? ""
    base.client_version = ""

    setForm(base)
    setDlgOpen(true)
  }

  async function onSave() {
    if (!userId) return toast.error("Pilih user")
    if (!form.manual_note || form.manual_note.trim().length < 3) {
      return toast.error("Alasan wajib diisi (min 3 karakter)")
    }

    try {
      const body = {
        check_in_at: form.check_in_time ? isoFromDateTime(form.work_date, form.check_in_time, tz) : null,
        check_out_at: form.check_out_time ? isoFromDateTime(form.work_date, form.check_out_time, tz) : null,
        check_in_geofence_id: form.in_geofence_id || null,
        check_out_geofence_id: form.out_geofence_id || null,
        check_in_leave_type: form.in_leave_type,
        check_out_leave_type: form.out_leave_type,
        check_in_leave_notes: form.in_leave_notes || null,
        check_out_leave_notes: form.out_leave_notes || null,
        device_id: form.device_id || null,
        device_model: form.device_model || null,
        client_version: form.client_version || null,
        manual_note: form.manual_note.trim(),
      }

      await upsertAttendanceAdmin(userId, form.work_date, body)
      toast.success("Absensi tersimpan")
      setDlgOpen(false)
      recapQ.refetch()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal menyimpan absensi")
    }
  }

  async function onDelete() {
    if (!userId) return toast.error("Pilih user")
    if (!confirm(`Hapus absensi tanggal ${form.work_date}?`)) return
    try {
      await deleteAttendanceAdmin(userId, form.work_date)
      toast.success("Absensi dihapus")
      setDlgOpen(false)
      recapQ.refetch()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal menghapus absensi")
    }
  }

  return (
    <div className="w-full p-0">
      <Card className="w-full rounded-none">
        <CardHeader>
          <CardTitle>Edit Absensi (SUPERADMIN)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="space-y-1">
              <Label>Satker</Label>
              <Select value={satkerId} onValueChange={onSatkerChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih satker" />
                </SelectTrigger>
                <SelectContent>
                  {(satkerQ.data ?? []).map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} - {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>User</Label>
              <Select value={userId} onValueChange={setUserId} disabled={!satkerId}>
                <SelectTrigger>
                  <SelectValue placeholder={satkerId ? "Pilih user" : "Pilih satker dulu"} />
                </SelectTrigger>
                <SelectContent>
                  {(usersQ.data ?? []).map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.nrp})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Dari</Label>
              <Input
                type="date"
                value={from}
                max={todayYmd}
                onChange={(e) => {
                  const v = e.target.value
                  setFrom(v > todayYmd ? todayYmd : v)
                }}
              />
            </div>
            <div className="space-y-1">
              <Label>Sampai</Label>
              <Input
                type="date"
                value={to}
                max={todayYmd}
                onChange={(e) => {
                  const v = e.target.value
                  setTo(v > todayYmd ? todayYmd : v)
                }}
              />
            </div>
          </div>

          {!userId ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Pilih Satker dan User untuk melihat data.</div>
          ) : (
            <div className="overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left">Tanggal</th>
                    <th className="px-3 py-2 text-left">Check In</th>
                    <th className="px-3 py-2 text-left">Check Out</th>
                    <th className="px-3 py-2 text-left">Status In</th>
                    <th className="px-3 py-2 text-left">Status Out</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.work_date} className="border-t">
                      <td className="px-3 py-2">{r.work_date}</td>
                      <td className="px-3 py-2">{fmtClock(r.check_in_at, tz)}</td>
                      <td className="px-3 py-2">{fmtClock(r.check_out_at, tz)}</td>
                      <td className="px-3 py-2">
                        {r.check_in_attendance_leave_type === "NORMAL" || !r.check_in_attendance_leave_type
                          ? (r.check_in_geofence_name ?? "-")
                          : `${r.check_in_attendance_leave_type}${r.check_in_attendance_leave_notes ? `: ${r.check_in_attendance_leave_notes}` : ""}`}
                      </td>
                      <td className="px-3 py-2">
                        {r.check_out_attendance_leave_type === "NORMAL" || !r.check_out_attendance_leave_type
                          ? (r.check_out_geofence_name ?? "-")
                          : `${r.check_out_attendance_leave_type}${r.check_out_attendance_leave_notes ? `: ${r.check_out_attendance_leave_notes}` : ""}`}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="sm" variant="outline" onClick={() => openForDate(r.work_date, r)}>
                          {r.check_in_at || r.check_out_at ? "Edit" : "Tambah"}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Absensi - {form.work_date}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="text-sm font-medium">Check In</div>

              <Label>Jam</Label>
              <Input
                type="time"
                value={form.check_in_time}
                onChange={(e) => setForm({ ...form, check_in_time: e.target.value })}
              />

              <Label>Geofence (opsional)</Label>
              <Select
                value={form.in_geofence_id || NONE_VALUE}
                onValueChange={(v) => setForm({ ...form, in_geofence_id: v === NONE_VALUE ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>-</SelectItem>
                  {geoBySatker.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label>Status / Leave Type</Label>
              <Select
                value={form.in_leave_type}
                onValueChange={(v) => setForm({ ...form, in_leave_type: v as LeaveType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((x) => (
                    <SelectItem key={x.value} value={x.value}>
                      {x.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {form.in_leave_type !== "NORMAL" && (
                <>
                  <Label>Catatan Leave (opsional)</Label>
                  <Input
                    value={form.in_leave_notes}
                    onChange={(e) => setForm({ ...form, in_leave_notes: e.target.value })}
                    placeholder="contoh: dinas luar / ijin / sakit..."
                  />
                </>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">Check Out</div>

              <Label>Jam</Label>
              <Input
                type="time"
                value={form.check_out_time}
                onChange={(e) => setForm({ ...form, check_out_time: e.target.value })}
              />

              <Label>Geofence (opsional)</Label>
              <Select
                value={form.out_geofence_id || NONE_VALUE}
                onValueChange={(v) => setForm({ ...form, out_geofence_id: v === NONE_VALUE ? "" : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="-" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_VALUE}>-</SelectItem>
                  {geoBySatker.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Label>Status / Leave Type</Label>
              <Select
                value={form.out_leave_type}
                onValueChange={(v) => setForm({ ...form, out_leave_type: v as LeaveType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((x) => (
                    <SelectItem key={x.value} value={x.value}>
                      {x.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {form.out_leave_type !== "NORMAL" && (
                <>
                  <Label>Catatan Leave (opsional)</Label>
                  <Input
                    value={form.out_leave_notes}
                    onChange={(e) => setForm({ ...form, out_leave_notes: e.target.value })}
                    placeholder="contoh: dinas luar / ijin / sakit..."
                  />
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Device ID (opsional)</Label>
              <Input value={form.device_id} onChange={(e) => setForm({ ...form, device_id: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Device Model (opsional)</Label>
              <Input value={form.device_model} onChange={(e) => setForm({ ...form, device_model: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Client Version (opsional)</Label>
              <Input value={form.client_version} onChange={(e) => setForm({ ...form, client_version: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Alasan koreksi (wajib)</Label>
            <Textarea
              value={form.manual_note}
              onChange={(e) => setForm({ ...form, manual_note: e.target.value })}
              placeholder="contoh: user protes sudah absen, tapi gangguan sistem (ticket #...)"
            />
            <div className="text-xs text-muted-foreground">
              Absensi yang disimpan dari halaman ini akan ditandai sebagai <b>Manual Correction</b> di backend.
            </div>
          </div>

          <DialogFooter>
            <Button variant="destructive" onClick={onDelete}>Delete</Button>
            <Button onClick={onSave}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
