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
import { listDutySchedules } from "@/features/duty-schedules/api"
import { listDecidedLeaveRequests } from "@/features/leave-requests/api"
import { useQuickApproveLeave } from "@/features/leave-requests/hooks"
import { listGeofences } from "@/features/geofences/api"
import { fetchAttendanceRecap, upsertAttendanceAdmin, deleteAttendanceAdmin } from "@/features/attendance/api"
import type { AttendanceRekapRow } from "@/features/attendance/types"
import type { Geofence } from "@/features/geofences/types"
import type { WorkingDay } from "@/features/working-days/types"
import type { DutyScheduleDto } from "@/features/duty-schedules/types"
import type { LeaveRequestDto } from "@/features/leave-requests/types"
import {apiErrorMessage} from "@/lib/api-error.ts";

type LeaveType = "NORMAL" | "DINAS_LUAR" | "WFA" | "WFH" | "IJIN" | "SAKIT"

//type LeaveTypeQuick = "DINAS_LUAR" | "IJIN" | "SAKIT"

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "DINAS_LUAR", label: "Dinas Luar" },
  { value: "WFA", label: "WFA" },
  { value: "WFH", label: "WFH" },
  { value: "IJIN", label: "Ijin" },
  { value: "SAKIT", label: "Sakit" },
]

const QUICK_APPROVE_TYPES = new Set<LeaveType>(["DINAS_LUAR", "IJIN", "SAKIT"])

function isQuickApproveType(t: LeaveType): t is "DINAS_LUAR" | "IJIN" | "SAKIT" {
  return QUICK_APPROVE_TYPES.has(t)
}



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

function isoToYmdInTz(iso: string, tz: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
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

function ymdToUtcDate(ymd: string) {
  // ymd: "2026-01-20" -> treat as UTC midnight to avoid client timezone shifting the date
  return new Date(`${ymd}T00:00:00Z`)
}

function utcDateToYmd(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function listYmdRangeInclusive(fromYmd: string, toYmd: string) {
  if (!fromYmd || !toYmd) return [] as string[]
  const start = ymdToUtcDate(fromYmd)
  const end = ymdToUtcDate(toYmd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [] as string[]
  if (end < start) return [] as string[]

  const out: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    out.push(utcDateToYmd(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function addDaysYmd(ymd: string, days: number) {
  const d = ymdToUtcDate(ymd)
  if (Number.isNaN(d.getTime())) return ymd
  d.setUTCDate(d.getUTCDate() + days)
  return utcDateToYmd(d)
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

function dayTypeLabel(d?: WorkingDay | undefined) {
  if (!d) return { text: "-", tone: "muted" as const }
  if (d.day_type === "HOLIDAY") return { text: "Holiday", tone: "destructive" as const }
  if (d.day_type === "HALF_DAY") return { text: "Half Day", tone: "warning" as const }
  return { text: "Workday", tone: "success" as const }
}

export default function AttendanceManagePage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const isSuperadmin = role === "SUPERADMIN"
  const isSatkerAdmin = role === "SATKER_ADMIN"



  const sessionSatkerId = session?.satkerId



  const tzQ = useTimezoneQuery()
  const tz = tzQ.data?.timezone ?? "Asia/Jakarta"

  const init = useMemo(() => defaultMonthRangeYmd(new Date(), tz), [tz])
  const todayYmd = init.to
  const [satkerId, setSatkerId] = useState<string>(isSatkerAdmin ? (sessionSatkerId ?? "") : "")
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
    return all.filter((g) => g.satker?.id === satkerId)
  }, [geosQ.data, satkerId])

  const recapEnabled = !!userId && !!from && !!to
  const recapQ = useQuery({
    queryKey: ["attendance", "recap", { userId, from, to }],
    queryFn: async () => fetchAttendanceRecap({ user_id: userId, from, to }),
    enabled: recapEnabled,
  })

  const wdsQ = useWorkingDays({ satkerId: satkerId, from, to })

  const dutyEnabled = !!userId && !!from && !!to
  const dutyQ = useQuery<DutyScheduleDto[]>({
    queryKey: ["duty-schedules", { userId, satkerId, from, to, tz }],
    queryFn: async () => {
      const fromIso = isoFromDateTime(from, "00:00", tz)
      const toIso = isoFromDateTime(addDaysYmd(to, 1), "00:00", tz) // exclusive
      const resp = await listDutySchedules({ from: fromIso, to: toIso, satker_id: satkerId || undefined, user_id: userId })
      return resp.data ?? []
    },
    enabled: dutyEnabled,
    staleTime: 10_000,
  })

  // Approved leave request lock: if a date is covered by an APPROVED leave-request,
  // SUPERADMIN should not be able to Add/Edit attendance for that date.
  const leaveEnabled = !!satkerId && !!from && !!to
  const leaveQ = useQuery<LeaveRequestDto[]>({
    queryKey: ["leave-requests", "decided", { satkerId, from, to }],
    queryFn: async () => {
      const resp = await listDecidedLeaveRequests({ from, to, satker_id: satkerId })
      return resp.data ?? []
    },
    enabled: leaveEnabled,
    staleTime: 10_000,
  })

  const rows = useMemo(() => {
    const att = recapQ.data ?? []
    const byDate = new Map(att.map((r) => [r.work_date, r]))
    const wds = wdsQ.data ?? []
    // If calendar exists, include HOLIDAY too so SUPERADMIN can edit/add attendance on holiday (e.g. duty schedule days).
    const calendarDates = wds.map((d) => d.work_date)
    // Fallback: if calendar not generated, show full date range so admin can still add/edit.
    const rangeDates = listYmdRangeInclusive(from, to)
    const finalDates = calendarDates.length ? calendarDates : (rangeDates.length ? rangeDates : Array.from(byDate.keys()).sort())

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
  }, [recapQ.data, wdsQ.data, userId, from, to])

  const dayByDate = useMemo(() => {
    const wds = wdsQ.data ?? []
    return new Map(wds.map((d) => [d.work_date, d]))
  }, [wdsQ.data])

  const dutyByDate = useMemo(() => {
    const out = new Map<string, DutyScheduleDto[]>()
    const items = dutyQ.data ?? []
    for (const s of items) {
      // Put schedule into every covered date (in selected timezone)
      const startYmd = isoToYmdInTz(s.start_at, tz)
      const endYmd = isoToYmdInTz(s.end_at, tz)
      if (!startYmd || !endYmd) continue
      const days = listYmdRangeInclusive(startYmd, endYmd)
      for (const d of days) {
        const arr = out.get(d) ?? []
        arr.push(s)
        out.set(d, arr)
      }
    }
    return out
  }, [dutyQ.data, tz])

  const leaveByDate = useMemo(() => {
    // Map each date to the most relevant leave-request info for this user
    // Priority: APPROVED > SUBMITTED > DRAFT > REJECTED > CANCELLED
    const prio: Record<string, number> = {
      APPROVED: 5,
      SUBMITTED: 4,
      DRAFT: 3,
      REJECTED: 2,
      CANCELLED: 1,
    }
    const out = new Map<string, LeaveRequestDto>()
    //const items = leaveQ.data ?? []
    const items = (leaveQ.data ?? []).filter(
        (lr) => lr.status !== "REJECTED"
    )
    for (const lr of items) {
      if (lr.user_id !== userId) continue
      const days = listYmdRangeInclusive(lr.start_date, lr.end_date)
      for (const d of days) {
        const cur = out.get(d)
        if (!cur) {
          out.set(d, lr)
          continue
        }
        const a = prio[lr.status] ?? 0
        const b = prio[cur.status] ?? 0
        if (a > b) out.set(d, lr)
      }
    }
    return out
  }, [leaveQ.data, userId])

  const approvedLeaveDates = useMemo(() => {
    const out = new Set<string>()
    for (const [d, lr] of leaveByDate.entries()) {
      if (lr.status === "APPROVED") out.add(d)
    }
    return out
  }, [leaveByDate])

  const [dlgOpen, setDlgOpen] = useState(false)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)

  const quickApproveM = useQuickApproveLeave()
  const [qaOpen, setQaOpen] = useState(false)
  const [qaNote, setQaNote] = useState("")

  function openForDate(dateYmd: string, row?: AttendanceRekapRow) {
    if (approvedLeaveDates.has(dateYmd)) {
      toast.error("Tidak bisa edit/tambah absensi karena ada leave-request yang sudah APPROVED pada tanggal ini")
      return
    }
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

    setQaNote("")
    setQaOpen(false)

    setForm(base)
    setDlgOpen(true)
  }

  async function onSave() {
    if (!userId) return toast.error("Pilih user")
    if (approvedLeaveDates.has(form.work_date)) {
      return toast.error("Tanggal ini terkunci karena leave-request sudah APPROVED")
    }

    // Check-in wajib diisi
    if (!form.check_in_time || !form.check_in_time.trim()) {
      return toast.error("Jam Check-in wajib diisi")
    }

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
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e) ?? "Gagal menyimpan absensi")
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
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e) ?? "Gagal menghapus absensi")
    }
  }

  async function onSubmitQuickApprove() {
    if (!userId) return toast.error("Pilih user")
    if (!isQuickApproveType(form.in_leave_type)) {
      return toast.error("Quick approve hanya untuk DINAS_LUAR/IJIN/SAKIT")
    }
    const hasDuty = (dutyByDate.get(form.work_date) ?? []).length > 0
    if (hasDuty) {
      return toast.error("Tanggal ini punya duty schedule, tidak perlu quick approve")
    }

    try {
      await quickApproveM.mutateAsync({
        user_id: userId,
        leave_type: form.in_leave_type,
        work_date: form.work_date,
        note: qaNote.trim() ? qaNote.trim() : null,
      })
      setQaOpen(false)
      setDlgOpen(false)
      // refresh lock state + recap
      await Promise.allSettled([leaveQ.refetch(), recapQ.refetch()])
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e) ?? "Gagal quick approve")
    }
  }

  if (!isSuperadmin && !isSatkerAdmin) {
    return (
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Akses ditolak</CardTitle>
            </CardHeader>
            <CardContent>Hanya SUPERADMIN / SATKER_ADMIN yang dapat mengedit absensi.</CardContent>
          </Card>
        </div>
    )
  }

  if (isSatkerAdmin && !sessionSatkerId) {
    return (
        <div className="p-6">
          <Card>
            <CardHeader>
              <CardTitle>Konfigurasi sesi tidak lengkap</CardTitle>
            </CardHeader>
            <CardContent>Session tidak memiliki satkerId, jadi SATKER_ADMIN tidak bisa mengedit absensi.</CardContent>
          </Card>
        </div>
    )
  }

  return (
      <div className="w-full p-0">
        <Card className="w-full rounded-none">
          <CardHeader>
            <CardTitle>Edit Absensi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="space-y-1">
                <Label>Satker</Label>
                <Select value={satkerId} onValueChange={onSatkerChange} disabled={isSatkerAdmin}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih satker" />
                  </SelectTrigger>
                  <SelectContent>
                    {(satkerQ.data ?? []).filter((s) => isSuperadmin || s.id === sessionSatkerId).map((s) => (
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
                      <th className="px-3 py-2 text-left">Kalender</th>
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
                          <td className="px-3 py-2">
                            {(() => {
                              const d = dayByDate.get(r.work_date)
                              const info = dayTypeLabel(d)
                              const cls =
                                  info.tone === "destructive"
                                      ? "bg-red-500/15 text-red-300 border-red-500/30"
                                      : info.tone === "warning"
                                          ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                                          : info.tone === "success"
                                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                              : "bg-muted text-muted-foreground border-muted"

                              return (
                                  <div className="flex flex-col gap-1">
                                    <span className={`w-fit rounded-full border px-2 py-0.5 text-xs ${cls}`}>{info.text}</span>
                                    {d?.note ? <span className="text-xs text-muted-foreground line-clamp-1" title={d.note}>{d.note}</span> : null}
                                    {(() => {
                                      const ds = dutyByDate.get(r.work_date) ?? []
                                      if (!ds.length) return null
                                      const titles = ds
                                          .map((x) => (x.title ? `${x.schedule_type}: ${x.title}` : x.schedule_type))
                                          .join("\n")
                                      return (
                                          <span
                                              className="w-fit rounded-full border px-2 py-0.5 text-xs bg-blue-500/15 text-blue-300 border-blue-500/30"
                                              title={titles}
                                          >
                                    Duty ({ds.length})
                                  </span>
                                      )
                                    })()}

                                    {(() => {
                                      const lr = leaveByDate.get(r.work_date)
                                      if (!lr) return null

                                      const isApproved = lr.status === "APPROVED"
                                      const cls = isApproved
                                          ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                          : lr.status === "REJECTED"
                                              ? "bg-zinc-500/15 text-zinc-200 border-zinc-500/30"
                                              : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"

                                      const tip = [
                                        `Status: ${lr.status}`,
                                        `Tipe: ${lr.tipe}`,
                                        lr.reason ? `Alasan: ${lr.reason}` : null,
                                        lr.approver_full_name ? `Approver: ${lr.approver_full_name}` : null,
                                        lr.decision_note ? `Catatan: ${lr.decision_note}` : null,
                                      ].filter(Boolean).join("\n")

                                      return (
                                          <span
                                              className={`w-fit rounded-full border px-2 py-0.5 text-xs ${cls}`}
                                              title={tip}
                                          >
                                    Leave {lr.status} ({lr.tipe})
                                  </span>
                                      )
                                    })()}
                                  </div>
                              )
                            })()}
                          </td>
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
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={approvedLeaveDates.has(r.work_date)}
                                onClick={() => openForDate(r.work_date, r)}
                                title={(() => {
                                  if (approvedLeaveDates.has(r.work_date)) {
                                    const lr = leaveByDate.get(r.work_date)
                                    return lr ? `Terkunci (Leave APPROVED: ${lr.tipe})` : "Terkunci (Leave APPROVED)"
                                  }
                                  const lr = leaveByDate.get(r.work_date)
                                  return lr ? `Leave ${lr.status} (${lr.tipe})` : undefined
                                })()}
                            >
                              {approvedLeaveDates.has(r.work_date)
                                  ? "Terkunci"
                                  : (r.check_in_at || r.check_out_at ? "Edit" : "Tambah")}
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
              {(() => {
                const hasDuty = (dutyByDate.get(form.work_date) ?? []).length > 0
                const canQuick = !hasDuty && isQuickApproveType(form.in_leave_type) && !approvedLeaveDates.has(form.work_date)
                if (!canQuick) return null
                return (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setQaOpen(true)}
                        disabled={quickApproveM.isPending}
                        title="Membuat leave_request lalu langsung APPROVED (khusus DINAS_LUAR/IJIN/SAKIT) agar Tukin dihitung"
                    >
                      Approve Leave
                    </Button>
                )
              })()}
              <Button variant="destructive" onClick={onDelete}>Delete</Button>
              <Button onClick={onSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={qaOpen} onOpenChange={setQaOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Quick Approve Leave</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Tanggal</Label>
                <Input value={form.work_date} readOnly />
              </div>

              <div className="space-y-1">
                <Label>Tipe Leave</Label>
                <Input value={form.in_leave_type} readOnly />
                <div className="text-xs text-muted-foreground">
                  Quick approve hanya untuk <b>DINAS_LUAR</b>, <b>IJIN</b>, atau <b>SAKIT</b>.
                </div>
              </div>

              <div className="space-y-1">
                <Label>Note (opsional)</Label>
                <Textarea
                    value={qaNote}
                    onChange={(e) => setQaNote(e.target.value)}
                    placeholder="Catatan approver (mis: validasi manual oleh admin)"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setQaOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={onSubmitQuickApprove} disabled={quickApproveM.isPending}>
                {quickApproveM.isPending ? "Memproses..." : "Submit & Approve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  )
}



/*
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
import { listDutySchedules } from "@/features/duty-schedules/api"
import { listDecidedLeaveRequests } from "@/features/leave-requests/api"
import { useQuickApproveLeave } from "@/features/leave-requests/hooks"
import { listGeofences } from "@/features/geofences/api"
import { fetchAttendanceRecap, upsertAttendanceAdmin, deleteAttendanceAdmin } from "@/features/attendance/api"
import type { AttendanceRekapRow } from "@/features/attendance/types"
import type { Geofence } from "@/features/geofences/types"
import type { WorkingDay } from "@/features/working-days/types"
import type { DutyScheduleDto } from "@/features/duty-schedules/types"
import type { LeaveRequestDto } from "@/features/leave-requests/types"

type LeaveType = "NORMAL" | "DINAS_LUAR" | "WFA" | "WFH" | "IJIN" | "SAKIT"

const LEAVE_TYPES: { value: LeaveType; label: string }[] = [
  { value: "NORMAL", label: "Normal" },
  { value: "DINAS_LUAR", label: "Dinas Luar" },
  { value: "WFA", label: "WFA" },
  { value: "WFH", label: "WFH" },
  { value: "IJIN", label: "Ijin" },
  { value: "SAKIT", label: "Sakit" },
]

const QUICK_APPROVE_TYPES = new Set<LeaveType>(["DINAS_LUAR", "IJIN", "SAKIT"])

function isQuickApproveType(t: LeaveType): t is "DINAS_LUAR" | "IJIN" | "SAKIT" {
  return QUICK_APPROVE_TYPES.has(t)
}

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

function isoToYmdInTz(iso: string, tz: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d)
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

function ymdToUtcDate(ymd: string) {
  // ymd: "2026-01-20" -> treat as UTC midnight to avoid client timezone shifting the date
  return new Date(`${ymd}T00:00:00Z`)
}

function utcDateToYmd(d: Date) {
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function listYmdRangeInclusive(fromYmd: string, toYmd: string) {
  if (!fromYmd || !toYmd) return [] as string[]
  const start = ymdToUtcDate(fromYmd)
  const end = ymdToUtcDate(toYmd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [] as string[]
  if (end < start) return [] as string[]

  const out: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    out.push(utcDateToYmd(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function addDaysYmd(ymd: string, days: number) {
  const d = ymdToUtcDate(ymd)
  if (Number.isNaN(d.getTime())) return ymd
  d.setUTCDate(d.getUTCDate() + days)
  return utcDateToYmd(d)
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

function dayTypeLabel(d?: WorkingDay | undefined) {
  if (!d) return { text: "-", tone: "muted" as const }
  if (d.day_type === "HOLIDAY") return { text: "Holiday", tone: "destructive" as const }
  if (d.day_type === "HALF_DAY") return { text: "Half Day", tone: "warning" as const }
  return { text: "Workday", tone: "success" as const }
}

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

  const dutyEnabled = !!userId && !!from && !!to
  const dutyQ = useQuery<DutyScheduleDto[]>({
    queryKey: ["duty-schedules", { userId, satkerId, from, to, tz }],
    queryFn: async () => {
      const fromIso = isoFromDateTime(from, "00:00", tz)
      const toIso = isoFromDateTime(addDaysYmd(to, 1), "00:00", tz) // exclusive
      const resp = await listDutySchedules({ from: fromIso, to: toIso, satker_id: satkerId || undefined, user_id: userId })
      return resp.data ?? []
    },
    enabled: dutyEnabled,
    staleTime: 10_000,
  })

  // Approved leave request lock: if a date is covered by an APPROVED leave-request,
  // SUPERADMIN should not be able to Add/Edit attendance for that date.
  const leaveEnabled = !!satkerId && !!from && !!to
  const leaveQ = useQuery<LeaveRequestDto[]>({
    queryKey: ["leave-requests", "decided", { satkerId, from, to }],
    queryFn: async () => {
      const resp = await listDecidedLeaveRequests({ from, to, satker_id: satkerId })
      return resp.data ?? []
    },
    enabled: leaveEnabled,
    staleTime: 10_000,
  })

  const rows = useMemo(() => {
    const att = recapQ.data ?? []
    const byDate = new Map(att.map((r) => [r.work_date, r]))
    const wds = wdsQ.data ?? []
    // If calendar exists, include HOLIDAY too so SUPERADMIN can edit/add attendance on holiday (e.g. duty schedule days).
    const calendarDates = wds.map((d) => d.work_date)
    // Fallback: if calendar not generated, show full date range so admin can still add/edit.
    const rangeDates = listYmdRangeInclusive(from, to)
    const finalDates = calendarDates.length ? calendarDates : (rangeDates.length ? rangeDates : Array.from(byDate.keys()).sort())

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
  }, [recapQ.data, wdsQ.data, userId, from, to])

  const dayByDate = useMemo(() => {
    const wds = wdsQ.data ?? []
    return new Map(wds.map((d) => [d.work_date, d]))
  }, [wdsQ.data])

  const dutyByDate = useMemo(() => {
    const out = new Map<string, DutyScheduleDto[]>()
    const items = dutyQ.data ?? []
    for (const s of items) {
      // Put schedule into every covered date (in selected timezone)
      const startYmd = isoToYmdInTz(s.start_at, tz)
      const endYmd = isoToYmdInTz(s.end_at, tz)
      if (!startYmd || !endYmd) continue
      const days = listYmdRangeInclusive(startYmd, endYmd)
      for (const d of days) {
        const arr = out.get(d) ?? []
        arr.push(s)
        out.set(d, arr)
      }
    }
    return out
  }, [dutyQ.data, tz])

  const leaveByDate = useMemo(() => {
    // Map each date to the most relevant leave-request info for this user
    // Priority: APPROVED > SUBMITTED > DRAFT > REJECTED > CANCELLED
    const prio: Record<string, number> = {
      APPROVED: 5,
      SUBMITTED: 4,
      DRAFT: 3,
      REJECTED: 2,
      CANCELLED: 1,
    }
    const out = new Map<string, LeaveRequestDto>()
    const items = (leaveQ.data ?? []).filter(
        (lr) => lr.status !== "REJECTED"
    )
    for (const lr of items) {
      if (lr.user_id !== userId) continue
      const days = listYmdRangeInclusive(lr.start_date, lr.end_date)
      for (const d of days) {
        const cur = out.get(d)
        if (!cur) {
          out.set(d, lr)
          continue
        }
        const a = prio[lr.status] ?? 0
        const b = prio[cur.status] ?? 0
        if (a > b) out.set(d, lr)
      }
    }
    return out
  }, [leaveQ.data, userId])

  const approvedLeaveDates = useMemo(() => {
    const out = new Set<string>()
    for (const [d, lr] of leaveByDate.entries()) {
      if (lr.status === "APPROVED") out.add(d)
    }
    return out
  }, [leaveByDate])

  const [dlgOpen, setDlgOpen] = useState(false)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)

  const quickApproveM = useQuickApproveLeave()
  const [qaOpen, setQaOpen] = useState(false)
  const [qaNote, setQaNote] = useState("")

  function openForDate(dateYmd: string, row?: AttendanceRekapRow) {
    if (approvedLeaveDates.has(dateYmd)) {
      toast.error("Tidak bisa edit/tambah absensi karena ada leave-request yang sudah APPROVED pada tanggal ini")
      return
    }
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

    setQaNote("")
    setQaOpen(false)

    setForm(base)
    setDlgOpen(true)
  }

  async function onSave() {
    if (!userId) return toast.error("Pilih user")
    if (approvedLeaveDates.has(form.work_date)) {
      return toast.error("Tanggal ini terkunci karena leave-request sudah APPROVED")
    }

    // Check-in wajib diisi
    if (!form.check_in_time || !form.check_in_time.trim()) {
      return toast.error("Jam Check-in wajib diisi")
    }

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

  async function onSubmitQuickApprove() {
    if (!userId) return toast.error("Pilih user")
    if (!isQuickApproveType(form.in_leave_type)) {
      return toast.error("Quick approve hanya untuk DINAS_LUAR/IJIN/SAKIT")
    }
    const hasDuty = (dutyByDate.get(form.work_date) ?? []).length > 0
    if (hasDuty) {
      return toast.error("Tanggal ini punya duty schedule, tidak perlu quick approve")
    }

    try {
      await quickApproveM.mutateAsync({
        user_id: userId,
        leave_type: form.in_leave_type,
        work_date: form.work_date,
        note: qaNote.trim() ? qaNote.trim() : null,
      })
      setQaOpen(false)
      setDlgOpen(false)
      // refresh lock state + recap
      await Promise.allSettled([leaveQ.refetch(), recapQ.refetch()])
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal quick approve")
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
                      <th className="px-3 py-2 text-left">Kalender</th>
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
                          <td className="px-3 py-2">
                            {(() => {
                              const d = dayByDate.get(r.work_date)
                              const info = dayTypeLabel(d)
                              const cls =
                                  info.tone === "destructive"
                                      ? "bg-red-500/15 text-red-300 border-red-500/30"
                                      : info.tone === "warning"
                                          ? "bg-yellow-500/15 text-yellow-300 border-yellow-500/30"
                                          : info.tone === "success"
                                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                              : "bg-muted text-muted-foreground border-muted"

                              return (
                                  <div className="flex flex-col gap-1">
                                    <span className={`w-fit rounded-full border px-2 py-0.5 text-xs ${cls}`}>{info.text}</span>
                                    {d?.note ? <span className="text-xs text-muted-foreground line-clamp-1" title={d.note}>{d.note}</span> : null}
                                    {(() => {
                                      const ds = dutyByDate.get(r.work_date) ?? []
                                      if (!ds.length) return null
                                      const titles = ds
                                          .map((x) => (x.title ? `${x.schedule_type}: ${x.title}` : x.schedule_type))
                                          .join("\n")
                                      return (
                                          <span
                                              className="w-fit rounded-full border px-2 py-0.5 text-xs bg-blue-500/15 text-blue-300 border-blue-500/30"
                                              title={titles}
                                          >
                                    Duty ({ds.length})
                                  </span>
                                      )
                                    })()}

                                    {(() => {
                                      const lr = leaveByDate.get(r.work_date)
                                      if (!lr) return null

                                      const isApproved = lr.status === "APPROVED"
                                      const cls = isApproved
                                          ? "bg-purple-500/15 text-purple-300 border-purple-500/30"
                                          : lr.status === "REJECTED"
                                              ? "bg-zinc-500/15 text-zinc-200 border-zinc-500/30"
                                              : "bg-indigo-500/15 text-indigo-300 border-indigo-500/30"

                                      const tip = [
                                        `Status: ${lr.status}`,
                                        `Tipe: ${lr.tipe}`,
                                        lr.reason ? `Alasan: ${lr.reason}` : null,
                                        lr.approver_full_name ? `Approver: ${lr.approver_full_name}` : null,
                                        lr.decision_note ? `Catatan: ${lr.decision_note}` : null,
                                      ].filter(Boolean).join("\n")

                                      return (
                                          <span
                                              className={`w-fit rounded-full border px-2 py-0.5 text-xs ${cls}`}
                                              title={tip}
                                          >
                                    Leave {lr.status} ({lr.tipe})
                                  </span>
                                      )
                                    })()}
                                  </div>
                              )
                            })()}
                          </td>
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
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={approvedLeaveDates.has(r.work_date)}
                                onClick={() => openForDate(r.work_date, r)}
                                title={(() => {
                                  if (approvedLeaveDates.has(r.work_date)) {
                                    const lr = leaveByDate.get(r.work_date)
                                    return lr ? `Terkunci (Leave APPROVED: ${lr.tipe})` : "Terkunci (Leave APPROVED)"
                                  }
                                  const lr = leaveByDate.get(r.work_date)
                                  return lr ? `Leave ${lr.status} (${lr.tipe})` : undefined
                                })()}
                            >
                              {approvedLeaveDates.has(r.work_date)
                                  ? "Terkunci"
                                  : (r.check_in_at || r.check_out_at ? "Edit" : "Tambah")}
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
              {(() => {
                const hasDuty = (dutyByDate.get(form.work_date) ?? []).length > 0
                const canQuick = !hasDuty && isQuickApproveType(form.in_leave_type) && !approvedLeaveDates.has(form.work_date)
                if (!canQuick) return null
                return (
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setQaOpen(true)}
                        disabled={quickApproveM.isPending}
                        title="Membuat leave_request lalu langsung APPROVED (khusus DINAS_LUAR/IJIN/SAKIT) agar Tukin dihitung"
                    >
                      Approve Leave
                    </Button>
                )
              })()}
              <Button variant="destructive" onClick={onDelete}>Delete</Button>
              <Button onClick={onSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={qaOpen} onOpenChange={setQaOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Quick Approve Leave</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Tanggal</Label>
                <Input value={form.work_date} readOnly />
              </div>

              <div className="space-y-1">
                <Label>Tipe Leave</Label>
                <Input value={form.in_leave_type} readOnly />
                <div className="text-xs text-muted-foreground">
                  Quick approve hanya untuk <b>DINAS_LUAR</b>, <b>IJIN</b>, atau <b>SAKIT</b>.
                </div>
              </div>

              <div className="space-y-1">
                <Label>Note (opsional)</Label>
                <Textarea
                    value={qaNote}
                    onChange={(e) => setQaNote(e.target.value)}
                    placeholder="Catatan approver (mis: validasi manual oleh admin)"
                />
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setQaOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={onSubmitQuickApprove} disabled={quickApproveM.isPending}>
                {quickApproveM.isPending ? "Memproses..." : "Submit & Approve"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
  )
}
*/
