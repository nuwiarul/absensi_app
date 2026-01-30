import * as React from "react"
import { toast } from "sonner"

import { getSession } from "@/lib/auth"

import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useUsers } from "@/features/users/hooks"
import { useTimezoneQuery } from "@/features/settings/hooks"

import { useAttendanceRecap } from "@/features/attendance/hooks"
import { fetchSelfieBlob } from "@/features/attendance/api"
import type { AttendanceLeaveType, AttendanceRekapRow } from "@/features/attendance/types"

import { useWorkingDays } from "@/features/working-days/hooks"
import { useSatkerHeads } from "@/features/satker-head/hooks"
import type { WorkingDay } from "@/features/working-days/types"

import { useDutySchedules } from "@/features/duty-schedules/hooks"
import type { DutyScheduleDto } from "@/features/duty-schedules/types"

import { useLeaveRequests } from "@/features/leave-requests/hooks"
import type { LeaveRequestDto, LeaveType } from "@/features/leave-requests/types"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { RecapTableView } from "@/pages/attendance/recap/RecapTableView"
import { RecapCalendarView } from "@/pages/attendance/recap/RecapCalendarView"
import { RecapDayDetailDialog } from "@/pages/attendance/recap/RecapDayDetailDialog"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

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

function ymdInTz(d: Date, tz: string) {
  // en-CA yields YYYY-MM-DD
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    return ymdLocal(d)
  }
}

function addDaysYmd(ymd: string, days: number) {
  // Safe date math in UTC; input is YYYY-MM-DD
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function tzOffset(tz: string): string {
  if (tz === "Asia/Jayapura") return "+09:00"
  if (tz === "Asia/Makassar") return "+08:00"
  return "+07:00" // Asia/Jakarta default
}

function isoFromDateTime(dateYmd: string, timeHm: string, tz: string): string {
  // Example: 2026-01-19T00:00:00+08:00
  return `${dateYmd}T${timeHm}:00${tzOffset(tz)}`
}

function isoToYmdInTz(iso: string, tz: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    return ""
  }
}

/*function monthValueInTz(d: Date, tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(d)
    const y = parts.find((p) => p.type === "year")?.value
    const m = parts.find((p) => p.type === "month")?.value
    if (!y || !m) return toMonthValue(d)
    return `${y}-${m}`
  } catch {
    return toMonthValue(d)
  }
}*/

function fmtDateId(ymd?: string) {
  if (!ymd) return ""
  try {
    // Treat as calendar date (avoid timezone shifting)
    const d = new Date(`${ymd}T00:00:00`)
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d)
  } catch {
    return ymd
  }
}

function fmtClock(isoUtc?: string, tz?: string) {
  if (!isoUtc) return ""
  try {
    const d = new Date(isoUtc)
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: tz ?? "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d)
  } catch {
    return isoUtc
  }
}

function timeStrToSeconds(t: string) {
  // HH:MM or HH:MM:SS
  const parts = t.split(":")
  const h = Number(parts[0] ?? 0)
  const m = Number(parts[1] ?? 0)
  const s = Number(parts[2] ?? 0)
  return h * 3600 + m * 60 + s
}

function clockFromIsoInTz(isoUtc: string, tz: string) {
  // Return HH:MM:SS in tz
  const d = new Date(isoUtc)
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00"
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00"
  const ss = parts.find((p) => p.type === "second")?.value ?? "00"
  return `${hh}:${mm}:${ss}`
}

function calcEarlyOut(expectedEnd: string | null | undefined, checkOutIsoUtc: string | null | undefined, tz: string) {
  if (!expectedEnd || !checkOutIsoUtc) return { isEarlyOut: false, earlyOutMinutes: 0 }
  const expectedSec = timeStrToSeconds(expectedEnd)
  const actualClock = clockFromIsoInTz(checkOutIsoUtc, tz)
  const actualSec = timeStrToSeconds(actualClock)
  const diffSec = expectedSec - actualSec
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin > 0) return { isEarlyOut: true, earlyOutMinutes: diffMin }
  return { isEarlyOut: false, earlyOutMinutes: 0 }
}

function timeStrToMinutes(v?: string | null) {
  if (!v) return null
  const parts = v.split(":")
  if (parts.length < 2) return null
  const hh = parseInt(parts[0], 10)
  const mm = parseInt(parts[1], 10)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

function isoUtcToMinutesInTz(isoUtc?: string, tz?: string) {
  if (!isoUtc) return null
  try {
    const d = new Date(isoUtc)
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz ?? "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const parts = fmt.formatToParts(d)
    const hh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "", 10)
    const mm = parseInt(parts.find((p) => p.type === "minute")?.value ?? "", 10)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null
    return hh * 60 + mm
  } catch {
    return null
  }
}

function leaveLabel(t?: AttendanceLeaveType) {
  if (!t) return ""
  switch (t) {
    case "NORMAL":
      return "Normal"
    case "DINAS_LUAR":
      return "Dinas Luar"
    case "WFA":
      return "WFA"
    case "WFH":
      return "WFH"
    case "IJIN":
      return "Izin"
    case "SAKIT":
      return "Sakit"
    case "CUTI":
      return "Cuti"
    default:
      return t
  }
}

function mapLeaveTypeToAttendanceLeaveType(t: LeaveType): AttendanceLeaveType {
  switch (t) {
    case "IJIN":
      return "IJIN"
    case "SAKIT":
      return "SAKIT"
    case "DINAS_LUAR":
      return "DINAS_LUAR"
    case "CUTI":
      return "CUTI"
    default:
      return "IJIN"
  }
}

function statusOrFence(
    leaveType: AttendanceLeaveType | undefined,
    notes: string | undefined,
    geofenceName: string | undefined
) {
  if (!leaveType || leaveType === "NORMAL") {
    return geofenceName ?? ""
  }
  const base = leaveLabel(leaveType)
  return notes ? `${base} - ${notes}` : base
}

function pickDevice(r: AttendanceRekapRow) {
  return {
    device_id: r.check_in_device_id ?? r.check_out_device_id ?? "",
    device_name: r.check_in_device_name ?? r.check_out_device_name ?? "",
    device_model: r.check_in_device_model ?? r.check_out_device_model ?? "",
  }
}

function statusText(
    isPendingToday: boolean | undefined,
    isMissing: boolean | undefined,
    isMissingIn: boolean | undefined,
    isMissingOut: boolean | undefined,
    leaveType: AttendanceLeaveType | undefined,
    notes: string | undefined,
    geofenceName: string | undefined,
    opts?: { hasDuty?: boolean; hasCheckIn?: boolean }
) {
  // Duty rule:
  // - If there is duty schedule AND user has check-in => treat as "Duty" for both In/Out.
  // - If there is duty schedule AND no check-in => "Tanpa Absen".
  // This overrides missing_in/missing_out and also ignores late/early calculations.
  if (opts?.hasDuty) {
    if (isPendingToday && !opts.hasCheckIn && !leaveType) return "Belum Absen"
    if (opts.hasCheckIn) return "Duty"
    if (!leaveType) return "Tanpa Absen"
  }
  if (isPendingToday && !leaveType) return "Belum Absen"
  if (isMissingIn && !leaveType) return "Masuk Tidak Absen"
  if (isMissingOut && !leaveType) return "Pulang Tidak Absen"
  if (isMissing && !leaveType) return "Tanpa Absen"
  return statusOrFence(leaveType, notes, geofenceName)
}

function recapIndicator(r: any, tz: string): { label: string; dotClass: string } | null {
  // NOTE: sebelumnya kita warnai full-row, tapi itu bikin teks susah dibaca.
  // Sekarang indikator warna dipindah ke kolom Nama/NRP (dot kecil).

  // 0) Today pending (monitoring)
  if (r?.is_pending_today) return { label: "Belum Absen", dotClass: "bg-slate-400" }

  // Duty overrides missing/telat indicators
  if (r?.has_duty_schedule) {
    if (!r?.check_in_at) return { label: "Tanpa Absen (Duty)", dotClass: "bg-red-500" }
    return { label: "Duty", dotClass: "bg-sky-500" }
  }

  // 1) Missing attendance
  if (r?.is_missing) return { label: "Tanpa Absen", dotClass: "bg-red-500" }

  // 1b) Partial attendance
  if (r?.is_missing_in) return { label: "Masuk Tidak Absen", dotClass: "bg-orange-500" }
  if (r?.is_missing_out) return { label: "Pulang Tidak Absen", dotClass: "bg-orange-500" }

  // 2) Non-normal leave / assignment
  const lt: AttendanceLeaveType | undefined = r?.check_in_attendance_leave_type ?? r?.check_out_attendance_leave_type
  if (lt && lt !== "NORMAL") {
    if (lt === "DINAS_LUAR") return { label: "Dinas Luar", dotClass: "bg-blue-500" }
    if (lt === "WFA" || lt === "WFH") return { label: lt === "WFA" ? "WFA" : "WFH", dotClass: "bg-violet-500" }
    if (lt === "IJIN") return { label: "Izin", dotClass: "bg-amber-500" }
    if (lt === "SAKIT") return { label: "Sakit", dotClass: "bg-emerald-500" }
    if (lt === "CUTI") return { label: "Cuti", dotClass: "bg-teal-500" }
    return { label: leaveLabel(lt), dotClass: "bg-slate-500" }
  }

  // 3) Early check-out (only for normal attendance)
  if (r?.is_early_out) return { label: `Pulang Cepat${r?.early_out_minutes ? ` (${r.early_out_minutes}m)` : ""}`, dotClass: "bg-rose-500" }

  // 4) Late (only for normal attendance)
  const expectedMin = timeStrToMinutes(r?.expected_start)
  const inMin = isoUtcToMinutesInTz(r?.check_in_at, tz)
  if (expectedMin != null && inMin != null && inMin > expectedMin) return { label: "Telat", dotClass: "bg-yellow-500" }

  return null
}

type RecapKind =
    | "NORMAL"
    | "DUTY"
    | "TELAT"
    | "TANPA_ABSEN"
    | "BELUM_ABSEN"
    | "MISSING_IN"
    | "MISSING_OUT"
    | "PULANG_CEPAT"
    | "DINAS_LUAR"
    | "WFA"
    | "WFH"
    | "IJIN"
    | "SAKIT"
    | "CUTI"
    | "HOLIDAY"
    | "WEEKEND"

function recapKindFromRow(r: any, tz: string): { kind: RecapKind; label: string; detail?: string } {
  const dutyDetail = r?.has_duty_schedule
      ? `Duty Schedule${r?.duty_schedule_titles ? `: ${r.duty_schedule_titles}` : ""}`
      : undefined

  // Holiday row (from working_days) - no attendance (tanpa duty schedule)
  if (r?.day_type === "HOLIDAY" && !r?.has_duty_schedule) return { kind: "HOLIDAY", label: "Holiday" }

  // Today pending
  if (r?.is_pending_today) return { kind: "BELUM_ABSEN", label: "Belum Absen", detail: dutyDetail }

  // Duty rule:
  // - If there is duty schedule AND user has check-in => treat as "Duty" (ignore late/missing-out)
  // - If there is duty schedule AND no check-in => "Tanpa Absen"
  if (r?.has_duty_schedule) {
    if (r?.check_in_at) return { kind: "DUTY", label: "Duty", detail: dutyDetail }
    return { kind: "TANPA_ABSEN", label: "Tanpa Absen", detail: dutyDetail }
  }

  // Missing / partial
  if (r?.is_missing_in) return { kind: "MISSING_IN", label: "Masuk Tidak Absen", detail: dutyDetail }
  if (r?.is_missing_out) return { kind: "MISSING_OUT", label: "Pulang Tidak Absen", detail: dutyDetail }
  if (r?.is_missing) return { kind: "TANPA_ABSEN", label: "Tanpa Absen", detail: dutyDetail }

  // Early out
  if (r?.is_early_out) {
    const mins = r?.early_out_minutes
    const base = mins ? `${mins} menit lebih awal` : undefined
    const detail = [base, dutyDetail].filter(Boolean).join(" • ") || undefined
    return { kind: "PULANG_CEPAT", label: "Pulang Cepat", detail }
  }

  // Leave
  const lt: AttendanceLeaveType | undefined = r?.check_in_attendance_leave_type ?? r?.check_out_attendance_leave_type
  if (lt && lt !== "NORMAL") {
    const lbl = leaveLabel(lt)
    const notes = (r?.check_in_attendance_leave_notes ?? r?.check_out_attendance_leave_notes) as string | undefined
    const detail = [notes, dutyDetail].filter(Boolean).join(" • ") || undefined
    return { kind: lt as any, label: lbl, detail }
  }

  // Normal: compute late or show geofence
  const expectedMin = timeStrToMinutes(r?.expected_start)
  const inMin = isoUtcToMinutesInTz(r?.check_in_at, tz)
  const geo = (r?.check_in_geofence_name ?? r?.check_out_geofence_name) as string | undefined
  if (expectedMin != null && inMin != null && inMin > expectedMin) {
    const late = inMin - expectedMin
    const lateStr = late > 0 ? `${late} menit` : undefined
    const detail0 = lateStr ? (geo ? `${lateStr} • ${geo}` : lateStr) : geo
    const detail = [detail0, dutyDetail].filter(Boolean).join(" • ") || undefined
    return { kind: "TELAT", label: "Telat", detail }
  }
  const detail = [geo, dutyDetail].filter(Boolean).join(" • ") || undefined
  return { kind: "NORMAL", label: "Normal", detail }
}

function calendarCellClass(kind: RecapKind) {
  // Use subtle backgrounds so text stays readable.
  switch (kind) {
    case "HOLIDAY":
      return "bg-red-500/15 ring-1 ring-red-500/40"
    case "DUTY":
      return "bg-sky-500/12 ring-1 ring-sky-500/35"
    case "TANPA_ABSEN":
      return "bg-red-500/10 ring-1 ring-red-500/30"
    case "BELUM_ABSEN":
      return "bg-slate-500/10 ring-1 ring-slate-500/30"
    case "MISSING_IN":
    case "MISSING_OUT":
      return "bg-orange-500/10 ring-1 ring-orange-500/30"
    case "TELAT":
      return "bg-yellow-500/10 ring-1 ring-yellow-500/30"
    case "DUTY":
      return "bg-sky-500/10 ring-1 ring-sky-500/30"
    case "PULANG_CEPAT":
      return "bg-rose-500/10 ring-1 ring-rose-500/30"
    case "DINAS_LUAR":
      return "bg-blue-500/10 ring-1 ring-blue-500/30"
    case "WFA":
    case "WFH":
      return "bg-violet-500/10 ring-1 ring-violet-500/30"
    case "IJIN":
      return "bg-amber-500/10 ring-1 ring-amber-500/30"
    case "SAKIT":
      return "bg-emerald-500/10 ring-1 ring-emerald-500/30"
    case "CUTI":
      return "bg-teal-500/10 ring-1 ring-teal-500/30"
    case "WEEKEND":
      return "bg-muted/40"
    default:
      return "bg-background"
  }
}

function statusBadgeClass(kind: string) {
  // small accent without changing row background (keeps text readable)
  switch (kind) {
    case "Tanpa Absen":
      return "border-red-500 text-red-600"
    case "Telat":
      return "border-yellow-500 text-yellow-700"
    case "Masuk Tidak Absen":
    case "Pulang Tidak Absen":
      return "border-orange-500 text-orange-700"
    case "Pulang Cepat":
      return "border-rose-500 text-rose-700"
    case "Dinas Luar":
      return "border-blue-500 text-blue-600"
    case "Duty":
      return "border-sky-500 text-sky-600"
    case "WFA":
    case "WFH":
      return "border-violet-500 text-violet-600"
    case "Izin":
      return "border-amber-500 text-amber-700"
    case "Sakit":
      return "border-emerald-500 text-emerald-600"
    case "Cuti":
      return "border-teal-500 text-teal-600"
    case "Belum Absen":
      return "border-slate-400 text-slate-600"
    case "Normal":
    default:
      return "border-slate-300 text-slate-700"
  }
}

function statusBadgeNode(kind: string, detail?: string) {
  return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`text-xs ${statusBadgeClass(kind)}`}>
          {kind}
        </Badge>
        {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
      </div>
  )
}

function renderStatusIn(r: any, tz: string) {
  if (r?.is_pending_today) return statusBadgeNode("Belum Absen")

  // Duty rule:
  // - If there is duty schedule AND user has check-in => show "Duty" (ignore late)
  // - If there is duty schedule AND no check-in => "Tanpa Absen"
  if (r?.has_duty_schedule) {
    if (r?.check_in_at) {
      const detail = r?.duty_schedule_titles || undefined
      return statusBadgeNode("Duty", detail)
    }
    return statusBadgeNode("Tanpa Absen")
  }
  if (r?.is_missing_in) return statusBadgeNode("Masuk Tidak Absen")
  if (r?.is_missing) return statusBadgeNode("Tanpa Absen")
  if (r?.is_missing_in) return statusBadgeNode("Masuk Tidak Absen")

  const leaveType: AttendanceLeaveType | undefined = r?.check_in_attendance_leave_type
  if (leaveType && leaveType !== "NORMAL") {
    const kind = leaveLabel(leaveType)
    const detail = r?.check_in_attendance_leave_notes || undefined
    return statusBadgeNode(kind, detail)
  }

  // Normal → show geofence name. Add "Telat" badge if check-in time > expected.
  const expectedMin = timeStrToMinutes(r?.expected_start)
  const inMin = isoUtcToMinutesInTz(r?.check_in_at, tz)
  const isLate = expectedMin != null && inMin != null && inMin > expectedMin
  const fence = r?.check_in_geofence_name || ""
  return statusBadgeNode(isLate ? "Telat" : "Normal", fence)
}

function renderStatusOut(r: any) {
  if (r?.is_pending_today) return statusBadgeNode("Belum Absen")

  // Duty rule: jika sudah check-in, status out tetap "Duty" walau tidak check-out.
  if (r?.has_duty_schedule) {
    if (r?.check_in_at) {
      const detail = r?.duty_schedule_titles || undefined
      return statusBadgeNode("Duty", detail)
    }
    return statusBadgeNode("Tanpa Absen")
  }
  if (r?.is_missing_out) return statusBadgeNode("Pulang Tidak Absen")
  if (r?.is_missing) return statusBadgeNode("Tanpa Absen")

  const leaveType: AttendanceLeaveType | undefined = r?.check_out_attendance_leave_type
  if (leaveType && leaveType !== "NORMAL") {
    const kind = leaveLabel(leaveType)
    const detail = r?.check_out_attendance_leave_notes || undefined
    return statusBadgeNode(kind, detail)
  }

  // Early out (only for normal attendance)
  if (r?.is_early_out) {
    const mins = r?.early_out_minutes
    const detail = mins ? `${mins} menit lebih awal` : undefined
    return statusBadgeNode("Pulang Cepat", detail)
  }

  const fence = r?.check_out_geofence_name || ""
  return statusBadgeNode("Normal", fence)
}

// === PDF helpers (make Status In/Out clear in exported PDF) ===
type PdfStatus = { kind: string; detail?: string; manual?: boolean; manual_note?: string }

function _pdfAttachManual(s: PdfStatus, r: any): PdfStatus {
  if (!r?.is_manual) return s
  return { ...s, manual: true, manual_note: r?.manual_note || undefined }
}

function pdfStatusIn(r: any, tz: string): PdfStatus {
  if (r?.is_pending_today) return _pdfAttachManual({ kind: "Belum Absen" }, r)

  if (r?.has_duty_schedule) {
    if (r?.check_in_at) return _pdfAttachManual({ kind: "Duty", detail: r?.duty_schedule_titles || undefined }, r)
    return _pdfAttachManual({ kind: "Tanpa Absen" }, r)
  }
  if (r?.is_missing_in) return _pdfAttachManual({ kind: "Masuk Tidak Absen" }, r)
  if (r?.is_missing) return _pdfAttachManual({ kind: "Tanpa Absen" }, r)

  const leaveType: AttendanceLeaveType | undefined = r?.check_in_attendance_leave_type
  if (leaveType && leaveType !== "NORMAL") {
    return _pdfAttachManual({ kind: leaveLabel(leaveType), detail: r?.check_in_attendance_leave_notes || undefined }, r)
  }

  const expectedMin = timeStrToMinutes(r?.expected_start)
  const inMin = isoUtcToMinutesInTz(r?.check_in_at, tz)
  const isLate = expectedMin != null && inMin != null && inMin > expectedMin
  const fence = r?.check_in_geofence_name || ""
  return _pdfAttachManual({ kind: (isLate ? "Telat" : "Normal"), detail: fence || undefined, manual: !!r?.is_manual, manual_note: r?.manual_note || undefined }, r)
}



function pdfStatusOut(r: any): PdfStatus {
  if (r?.is_pending_today) return _pdfAttachManual({ kind: "Belum Absen" }, r)

  if (r?.has_duty_schedule) {
    if (r?.check_in_at) return _pdfAttachManual({ kind: "Duty", detail: r?.duty_schedule_titles || undefined }, r)
    return _pdfAttachManual({ kind: "Tanpa Absen" }, r)
  }
  if (r?.is_missing_out) return _pdfAttachManual({ kind: "Pulang Tidak Absen" }, r)
  if (r?.is_missing) return _pdfAttachManual({ kind: "Tanpa Absen" }, r)

  const leaveType: AttendanceLeaveType | undefined = r?.check_out_attendance_leave_type
  if (leaveType && leaveType !== "NORMAL") {
    return _pdfAttachManual({ kind: leaveLabel(leaveType), detail: r?.check_out_attendance_leave_notes || undefined }, r)
  }

  if (r?.is_early_out) {
    const mins = r?.early_out_minutes
    return _pdfAttachManual({ kind: "Pulang Cepat", detail: mins ? `${mins} menit lebih awal` : undefined }, r)
  }

  const fence = r?.check_out_geofence_name || ""
  return _pdfAttachManual({ kind: "Normal", detail: fence || undefined }, r)
}

function pdfFillForKind(kind: string): [number, number, number] | null {
  // Light fills so text stays readable in print.
  switch (kind) {
    case "Belum Absen":
      return [245, 245, 245] // light gray
    case "Tanpa Absen":
      return [255, 235, 238] // very light red
    case "Telat":
      return [255, 249, 196] // very light yellow
    case "Pulang Cepat":
      return [255, 240, 245] // very light rose
    case "Masuk Tidak Absen":
    case "Pulang Tidak Absen":
      return [255, 243, 224] // very light orange
    case "Dinas Luar":
      return [227, 242, 253] // very light blue
    case "Duty":
      return [227, 242, 253] // very light blue (same as Dinas Luar)
    case "WFA":
    case "WFH":
      return [243, 229, 245] // very light purple
    case "Izin":
      return [255, 243, 224] // very light orange
    case "Sakit":
      return [232, 245, 233] // very light green
    case "Cuti":
      return [224, 242, 241] // very light teal
    default:
      return null
  }
}

function pdfStatusCellText(s: PdfStatus): string {
  const line1 = s.manual ? `${s.kind} (Manual)` : s.kind
  const arr: string[] = [line1]
  if (s.detail) arr.push(s.detail)
  if (s.manual_note) arr.push(`Alasan: ${s.manual_note}`)
  return arr.join("\n")
}


export default function AttendanceRecapPage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const { data: satkers = [] } = useSatkers()
  const tzQ = useTimezoneQuery()
  const tz = tzQ.data?.timezone ?? "Asia/Jakarta"

  // Rekap ditampilkan sampai HARI SEBELUMNYA (yesterday) agar hari ini / masa depan
  // tidak langsung dianggap "Tanpa Absen".
  const todayYmd = React.useMemo(() => ymdInTz(new Date(), tz), [tz])
  const yesterdayYmd = React.useMemo(() => ymdInTz(new Date(Date.now() - 24 * 60 * 60 * 1000), tz), [tz])
  const currentMonthTz = React.useMemo(() => todayYmd.slice(0, 7), [todayYmd])

  // OFF default: report sampai kemarin. ON: tampilkan hari ini untuk monitoring.
  // Catatan: hari ini tidak pernah dihitung sebagai "Tanpa Absen".
  const [showToday, setShowToday] = React.useState(false)

  // Default tampilan: tabel. Ada opsi kalender.
  const [viewMode, setViewMode] = React.useState<"table" | "calendar">("table")

  // Dialog detail tanggal (untuk tampilan kalender)
  const [dayOpen, setDayOpen] = React.useState(false)
  const [dayYmd, setDayYmd] = React.useState<string>("")

  const [satkerId, setSatkerId] = React.useState<string>(() => {
    if (role === "SATKER_ADMIN" || role === "SATKER_HEAD") return session?.satkerId ?? ""
    return ""
  })

  React.useEffect(() => {
    if (role === "SATKER_ADMIN" || role === "SATKER_HEAD") {
      if (session?.satkerId && satkerId !== session.satkerId) setSatkerId(session.satkerId)
      return
    }
    if (!satkerId && satkers.length > 0) setSatkerId(satkers[0].id)
  }, [role, session?.satkerId, satkerId, satkers])

  const usersQ = useUsers(satkerId)
  const users = usersQ.data ?? []

  const [userId, setUserId] = React.useState<string>("")

  // UX rule:
  // - SUPERADMIN: jangan auto-select user (biar tidak bingung saat ganti satker)
  // - SATKER_ADMIN / SATKER_HEAD: boleh auto-select user pertama
  React.useEffect(() => {
    if (role === "SUPERADMIN") return
    if (!userId && users.length > 0) setUserId(users[0].id)
  }, [role, userId, users])

  // Saat ganti satker (khusus SUPERADMIN), kosongkan user supaya tabel tidak menampilkan data satker sebelumnya.
  React.useEffect(() => {
    if (role !== "SUPERADMIN") return
    setUserId("")
  }, [role, satkerId])

  const [month, setMonth] = React.useState(() => toMonthValue(new Date()))
  const [from, setFrom] = React.useState(() => ymdLocal(firstOfMonth(new Date())))
  const [to, setTo] = React.useState(() => ymdLocal(lastOfMonth(new Date())))

  // Jika admin memilih range yang mencakup hari ini / masa depan, otomatis potong.
  // - showToday=false => maksimal kemarin
  // - showToday=true  => maksimal hari ini
  React.useEffect(() => {
    if (!from || !to) return
    const maxTo = showToday ? todayYmd : yesterdayYmd
    if (to > maxTo) {
      const clipped = maxTo < from ? from : maxTo
      if (clipped !== to) setTo(clipped)
    }
  }, [from, to, todayYmd, yesterdayYmd, showToday])

  // month picker default: set range 1 bulan
  React.useEffect(() => {
    const y = parseInt(month.slice(0, 4), 10)
    const m = parseInt(month.slice(5, 7), 10) - 1
    if (Number.isNaN(y) || Number.isNaN(m)) return
    const d = new Date(y, m, 1)
    const fromYmd = ymdLocal(firstOfMonth(d))
    const toMonthEnd = ymdLocal(lastOfMonth(d))
    // Kalau bulan yang dipilih adalah bulan berjalan (di timezone settings),
    // maka batas akhir = kemarin (default) atau hari ini (jika showToday=true).
    const cap = showToday ? todayYmd : yesterdayYmd
    const effectiveTo =
        month === currentMonthTz
            ? cap < fromYmd
                ? fromYmd
                : cap < toMonthEnd
                    ? cap
                    : toMonthEnd
            : toMonthEnd
    setFrom(fromYmd)
    setTo(effectiveTo)
  }, [month, currentMonthTz, yesterdayYmd, todayYmd, showToday])

  const query = React.useMemo(() => {
    if (!userId || !from || !to) return null
    return { from, to, user_id: userId }
  }, [from, to, userId])

  const recapQ = useAttendanceRecap(query ?? { from: "1970-01-01", to: "1970-01-01", user_id: "" }, Boolean(query))
  const rows: AttendanceRekapRow[] = recapQ.data ?? []

  // Leave yang sudah di-APPROVED oleh Head Satker (atau Superadmin) juga ditampilkan di rekap.
  // Kita fetch leave by range, lalu filter per user + satker di client.
  const leaveQ = useLeaveRequests({ from, to }, Boolean(userId && from && to))
  const leaveRows: LeaveRequestDto[] = leaveQ.data?.data ?? []

  const workingDaysQ = useWorkingDays(
      { satkerId, from, to },
      Boolean(satkerId && from && to && userId)
  )
  const workingDays: WorkingDay[] = workingDaysQ.data ?? []

  // Duty schedule (jadwal dinas) perlu ikut tampil di rekap, termasuk saat holiday.
  const dutyQuery = React.useMemo(() => {
    if (!userId || !from || !to) return null
    const fromIso = isoFromDateTime(from, "00:00", tz)
    const toIso = isoFromDateTime(addDaysYmd(to, 1), "00:00", tz) // exclusive
    return { from: fromIso, to: toIso, user_id: userId, satker_id: satkerId || undefined }
  }, [userId, from, to, tz, satkerId])
  const dutyQ = useDutySchedules(
      dutyQuery ?? { from: "1970-01-01T00:00:00+00:00", to: "1970-01-02T00:00:00+00:00" },
      Boolean(dutyQuery)
  )
  const dutyRows: DutyScheduleDto[] = (dutyQ.data?.data ?? []) as DutyScheduleDto[]

  const satkerHeadsQ = useSatkerHeads()
  const satkerHeads = satkerHeadsQ.data ?? []

  const selectedUser = users.find((u) => u.id === userId)
  const selectedSatker = satkers.find((s) => s.id === satkerId)

  type RecapRowEx = AttendanceRekapRow & {
    is_missing?: boolean
    is_missing_in?: boolean
    is_missing_out?: boolean
    is_pending_today?: boolean
    calendar_day_type?: "WORKDAY" | "HALF_DAY" | "HOLIDAY"
    expected_start?: string | null
    expected_end?: string | null
    is_early_out?: boolean
    early_out_minutes?: number
    has_duty_schedule?: boolean
    duty_schedule_titles?: string
  }

  const mergedRows: RecapRowEx[] = React.useMemo(() => {
    if (!userId) return []
    if (!from || !to) return rows as RecapRowEx[]

    const byDate = new Map<string, AttendanceRekapRow>()
    for (const r of rows) byDate.set(r.work_date, r)

    const wdByDate = new Map<string, WorkingDay>()
    for (const w of workingDays) wdByDate.set(w.work_date, w)

    // Map approved leave per-date for selected user.
    // Priority: APPROVED leave overrides "Tanpa Absen" for that day.
    const leaveByDate = new Map<string, LeaveRequestDto>()
    for (const lr of leaveRows) {
      if (lr.status !== "APPROVED") continue
      if (lr.user_id !== userId) continue
      // SUPERADMIN bisa dapat data semua satker, jadi filter satker juga.
      if (satkerId && lr.satker_id !== satkerId) continue

      let cur = lr.start_date
      // clamp to selected range
      if (cur < from) cur = from
      const end = lr.end_date > to ? to : lr.end_date
      while (cur <= end) {
        // Jika ada multiple leave menimpa hari yang sama, keep yang pertama.
        if (!leaveByDate.has(cur)) leaveByDate.set(cur, lr)
        cur = addDaysYmd(cur, 1)
      }
    }

    // Map duty schedule per-date for selected user.
    // - Jadi kalau hari tersebut (termasuk holiday) punya jadwal dinas,
    //   tetap ikut tampil di rekap.
    const dutyByDate = new Map<string, DutyScheduleDto[]>()
    for (const ds of dutyRows) {
      if (ds.user_id !== userId) continue
      // superadmin bisa dapat data semua satker (jaga-jaga)
      if (satkerId && ds.satker_id !== satkerId) continue

      const startYmd = isoToYmdInTz(ds.start_at, tz)
      const endYmd = isoToYmdInTz(ds.end_at, tz)
      if (!startYmd || !endYmd) continue
      let cur = startYmd
      const end = endYmd > to ? to : endYmd
      if (cur < from) cur = from
      while (cur <= end) {
        const arr = dutyByDate.get(cur) ?? []
        arr.push(ds)
        dutyByDate.set(cur, arr)
        cur = addDaysYmd(cur, 1)
      }
    }

    // Generate rows for calendar WORKDAY/HALF_DAY, dan HOLIDAY jika ada duty schedule.
    const out: RecapRowEx[] = []
    for (const [date, w] of wdByDate.entries()) {
      // Masa depan tidak pernah ditampilkan.
      if (date > todayYmd) continue
      // Hari ini hanya tampil jika showToday=true.
      if (date === todayYmd && !showToday) continue
      const duties = dutyByDate.get(date)
      const hasDuty = !!(duties && duties.length)
      const dutyTitles = hasDuty
          ? Array.from(
              new Set(
                  duties!
                      .map((d) => d.title || d.schedule_type || "DUTY_SCHEDULE")
                      .filter(Boolean)
              )
          ).join(", ")
          : ""

      // Holiday normal tidak perlu tampil di table rekap.
      // Tapi kalau ada duty schedule, wajib tampil.
      const r0 = byDate.get(date)
      const leave0 = leaveByDate.get(date)
      if (w.day_type === "HOLIDAY" && !hasDuty && !r0 && !leave0) continue
      const r = r0
      if (r) {
        const isPast = date < todayYmd
        const ltAny: AttendanceLeaveType | undefined =
            r.check_in_attendance_leave_type ?? r.check_out_attendance_leave_type
        const hasNonNormalLeave = ltAny && ltAny !== "NORMAL"
        // Missing in/out hanya berlaku untuk hari yang sudah lewat dan bukan leave.
        const isMissingIn = isPast && !hasNonNormalLeave && !r.check_in_at && !!r.check_out_at && !hasDuty
        const isMissingOut = isPast && !hasNonNormalLeave && !!r.check_in_at && !r.check_out_at && !hasDuty
        const { isEarlyOut, earlyOutMinutes } = calcEarlyOut(
            w.expected_end,
            r.check_out_at,
            tz
        )
        out.push({
          ...r,
          has_duty_schedule: hasDuty,
          duty_schedule_titles: dutyTitles,
          is_missing_in: isMissingIn,
          is_missing_out: isMissingOut,
          is_early_out: isPast && !hasNonNormalLeave && !isMissingOut && isEarlyOut,
          early_out_minutes: isPast && !hasNonNormalLeave && !isMissingOut && isEarlyOut ? earlyOutMinutes : 0,
          calendar_day_type: w.day_type,
          expected_start: w.expected_start,
          expected_end: w.expected_end,
        })
      } else {
        // No attendance record.
        // 1) if APPROVED leave exists for this date => show leave
        const leave = leave0
        if (leave) {
          const at = mapLeaveTypeToAttendanceLeaveType(leave.tipe)
          const note = (leave.reason ?? leave.decision_note ?? "") as string
          out.push({
            session_id: `leave-${leave.id}-${date}`,
            work_date: date,
            user_id: userId,
            full_name: selectedUser?.full_name ?? "",
            nrp: selectedUser?.nrp ?? "",
            satker_name: selectedSatker?.name ?? "",
            satker_code: selectedSatker?.code ?? "",
            check_in_attendance_leave_type: at,
            check_out_attendance_leave_type: at,
            check_in_attendance_leave_notes: note,
            check_out_attendance_leave_notes: note,
            has_duty_schedule: hasDuty,
            duty_schedule_titles: dutyTitles,
            calendar_day_type: w.day_type,
            expected_start: w.expected_start,
            expected_end: w.expected_end,
          })
        } else {
          // 2) Hari ini: jangan pernah dianggap "Tanpa Absen". Tampilkan sebagai "Belum Absen".
          const isToday = date === todayYmd
          const isPast = date < todayYmd
          out.push({
            session_id: `${isToday ? "pending" : "missing"}-${userId}-${date}`,
            work_date: date,
            user_id: userId,
            full_name: selectedUser?.full_name ?? "",
            nrp: selectedUser?.nrp ?? "",
            satker_name: selectedSatker?.name ?? "",
            satker_code: selectedSatker?.code ?? "",
            // Jika ada duty schedule, maka holiday pun bisa dianggap tanpa absen.
            is_missing: !isToday && (w.day_type !== "HOLIDAY" || hasDuty) && isPast,
            is_pending_today: isToday,
            has_duty_schedule: hasDuty,
            duty_schedule_titles: dutyTitles,
            calendar_day_type: w.day_type,
            expected_start: w.expected_start,
            expected_end: w.expected_end,
          })
        }
      }
    }

    // If calendar not generated, fallback to raw rows (tetap filter sampai kemarin).
    if (out.length === 0) {
      // Jika calendar belum di-generate, fallback ke raw rows:
      // - masa depan tidak tampil
      // - hari ini tampil hanya jika showToday=true
      const base = (rows as RecapRowEx[])
          .filter((r) => (showToday ? r.work_date <= todayYmd : r.work_date < todayYmd))
          .map((r) => {
            const isPast = r.work_date < todayYmd
            const ltAny: AttendanceLeaveType | undefined =
                r.check_in_attendance_leave_type ?? r.check_out_attendance_leave_type
            const hasNonNormalLeave = ltAny && ltAny !== "NORMAL"
            const duties = dutyByDate.get(r.work_date)
            const hasDuty = !!(duties && duties.length)
            const isMissingIn = isPast && !hasNonNormalLeave && !r.check_in_at && !!r.check_out_at && !hasDuty
            const isMissingOut = isPast && !hasNonNormalLeave && !!r.check_in_at && !r.check_out_at && !hasDuty
            const dutyTitles = hasDuty
                ? Array.from(new Set(duties!.map((d) => d.title || d.schedule_type || "DUTY_SCHEDULE").filter(Boolean))).join(", ")
                : ""
            return { ...r, is_missing_in: isMissingIn, is_missing_out: isMissingOut, has_duty_schedule: hasDuty, duty_schedule_titles: dutyTitles }
          })

      // Tambahkan baris untuk tanggal yang punya duty schedule tapi tidak punya attendance record.
      // (khusus saat calendar belum di-generate)
      const existing = new Set(base.map((r) => r.work_date))
      for (const [date, duties] of dutyByDate.entries()) {
        if (!date || date < from || date > to) continue
        if (date > todayYmd) continue
        if (date === todayYmd && !showToday) continue
        if (existing.has(date)) continue

        const dutyTitles = Array.from(
            new Set(duties.map((d) => d.title || d.schedule_type || "DUTY_SCHEDULE").filter(Boolean))
        ).join(", ")

        const isToday = date === todayYmd
        base.push({
          session_id: `${isToday ? "pending" : "missing"}-${userId}-${date}`,
          work_date: date,
          user_id: userId,
          full_name: selectedUser?.full_name ?? "",
          nrp: selectedUser?.nrp ?? "",
          satker_name: selectedSatker?.name ?? "",
          satker_code: selectedSatker?.code ?? "",
          is_missing: !isToday,
          is_pending_today: isToday,
          has_duty_schedule: true,
          duty_schedule_titles: dutyTitles,
        })
      }

      base.sort((a, b) => a.work_date.localeCompare(b.work_date))
      return base
    }

    // Sort by work_date asc
    out.sort((a, b) => a.work_date.localeCompare(b.work_date))
    return out
  }, [from, to, rows, workingDays, dutyRows, tz, leaveRows, satkerId, userId, selectedUser?.full_name, selectedUser?.nrp, selectedSatker?.name, selectedSatker?.code, todayYmd, showToday])

  const mergedByDate = React.useMemo(() => {
    const m = new Map<string, RecapRowEx>()
    for (const r of mergedRows) m.set(r.work_date, r)
    return m
  }, [mergedRows])

  const workingDayByDate = React.useMemo(() => {
    const m = new Map<string, WorkingDay>()
    for (const w of workingDays) m.set(w.work_date, w)
    return m
  }, [workingDays])

  const summary = React.useMemo(() => {
    const s = {
      totalHariKerja: 0,
      hadir: 0,
      telat: 0,
      pulangCepat: 0,
      tanpaAbsen: 0,
      lupaCheckIn: 0,
      lupaCheckOut: 0,
      dinasLuar: 0,
      wfa: 0,
      wfh: 0,
      izin: 0,
      sakit: 0,
      cuti: 0,
    }

    for (const r of mergedRows) {
      // Hari ini (mode monitoring) tidak ikut perhitungan summary agar tidak
      // salah dianggap "tanpa absen" atau mengganggu statistik bulanan.
      if ((r as any).is_pending_today) continue
      // Count hari kerja:
      // - WORKDAY/HALF_DAY selalu dihitung
      // - HOLIDAY hanya dihitung jika ada duty schedule
      if (r.calendar_day_type === "WORKDAY" || r.calendar_day_type === "HALF_DAY") {
        s.totalHariKerja += 1
      } else if (r.has_duty_schedule) {
        s.totalHariKerja += 1
      }

      const lt = r.check_in_attendance_leave_type ?? r.check_out_attendance_leave_type

      // Duty: jika tidak ada check-in, dianggap Tanpa Absen walaupun holiday
      if (r.has_duty_schedule) {
        if (!r.check_in_at) {
          s.tanpaAbsen += 1
          continue
        }
      }

      if (!r.check_in_at && !r.check_out_at && !lt) {
        if (r.calendar_day_type === "WORKDAY" || r.calendar_day_type === "HALF_DAY") {
          s.tanpaAbsen += 1
        }
        continue
      }

      if (lt && lt !== "NORMAL") {
        if (lt === "DINAS_LUAR") s.dinasLuar += 1
        if (lt === "WFA") s.wfa += 1
        if (lt === "WFH") s.wfh += 1
        if (lt === "IJIN") s.izin += 1
        if (lt === "SAKIT") s.sakit += 1
        if (lt === "CUTI") s.cuti += 1
        // treat non-normal leave as present (can be adjusted later)
        s.hadir += 1
        continue
      }

      // Normal attendance present
      if (r.check_in_at || r.check_out_at) {
        s.hadir += 1

        // Duty: jangan hitung telat / lupa checkout untuk duty
        if (!r.has_duty_schedule) {
          if ((r as any).is_missing_in) s.lupaCheckIn += 1
          if ((r as any).is_missing_out) s.lupaCheckOut += 1
          if ((r as any).is_early_out) s.pulangCepat += 1

          const expectedMin = timeStrToMinutes(r.expected_start)
          const inMin = isoUtcToMinutesInTz(r.check_in_at, tz)
          if (expectedMin != null && inMin != null && inMin > expectedMin) {
            s.telat += 1
          }
        }
      }
    }
    return s
  }, [mergedRows, tz])

  const kepalaSatkerName = React.useMemo(() => {
    if (!satkerId) return ""
    const today = ymdLocal(new Date())
    const items = satkerHeads.filter((h) => h.satker_id === satkerId)
    // prefer active today
    const active = items.find((h) => h.active_from <= today && (!h.active_to || h.active_to >= today))
    return (active ?? items[0])?.full_name ?? ""
  }, [satkerHeads, satkerId])

  const calendar = React.useMemo(() => {
    // Render kalender untuk bulan yang dipilih (month picker)
    const y = parseInt(month.slice(0, 4), 10)
    const m = parseInt(month.slice(5, 7), 10) - 1
    const first = new Date(y, m, 1)
    const daysInMonth = new Date(y, m + 1, 0).getDate()

    // Monday as start of week (ID convention)
    const jsDow = first.getDay() // 0=Sun
    const offset = (jsDow + 6) % 7 // 0=Mon

    const cells: Array<{
      ymd: string
      day: number
      inMonth: boolean
      disabled: boolean
      kind: RecapKind
      label: string
      detail?: string
      is_manual?: boolean
    }> = []

    // Fill 6 weeks x 7 days = 42 cells
    for (let idx = 0; idx < 42; idx++) {
      const dayNum = idx - offset + 1
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth
      const d = new Date(y, m, Math.min(Math.max(dayNum, 1), daysInMonth))
      const ymd = ymdLocal(new Date(y, m, dayNum))

      // Determine disabled state: outside month or outside selected range
      const outOfRange = !inMonth || (from && ymd < from) || (to && ymd > to)
      const isWeekend = (() => {
        const dow = new Date(`${ymd}T00:00:00`).getDay()
        return dow === 0 || dow === 6
      })()

      // Determine kind/label
      let kind: RecapKind = isWeekend ? "WEEKEND" : "NORMAL"
      let label = ""
      let detail: string | undefined

      if (inMonth && !outOfRange) {
        const wd = workingDayByDate.get(ymd)
        const r = mergedByDate.get(ymd)
        if (wd?.day_type === "HOLIDAY" && !r) {
          kind = "HOLIDAY"
          label = "Holiday"
        } else if (r) {
          const k = recapKindFromRow(r, tz)
          kind = k.kind
          label = k.label
          detail = k.detail
        } else {
          // Hari kerja tanpa row attendance biasanya sudah ada di mergedRows.
          // Tapi jika calendar belum di-generate lengkap, tetap aman.
          kind = isWeekend ? "WEEKEND" : "NORMAL"
          label = ""
        }

        // Mark half day explicitly in calendar label
        if (wd?.day_type === "HALF_DAY") {
          label = label ? `${label} • Half Day` : "Half Day"
        }
      }

      cells.push({
        ymd,
        day: dayNum,
        inMonth,
        disabled: outOfRange,
        kind,
        label,
        detail,
        is_manual: Boolean((mergedByDate.get(ymd) as any)?.is_manual),
      })
    }

    return { year: y, month: m, cells }
  }, [month, from, to, mergedByDate, workingDayByDate, tz])

  const selectedDayRow = React.useMemo<RecapRowEx | null>(() => {
    if (!dayYmd) return null
    return mergedByDate.get(dayYmd) ?? null
  }, [dayYmd, mergedByDate])

  const selectedDayInfo = React.useMemo(() => {
    if (!dayYmd) return null
    const wd = workingDayByDate.get(dayYmd)
    const r = mergedByDate.get(dayYmd)
    if (wd?.day_type === "HOLIDAY" && !r) {
      return { kind: "HOLIDAY" as RecapKind, label: "Holiday" }
    }
    if (r) return recapKindFromRow(r, tz)
    return { kind: "NORMAL" as RecapKind, label: "Normal" }
  }, [dayYmd, mergedByDate, workingDayByDate, tz])

  const [imgOpen, setImgOpen] = React.useState(false)
  const [imgUrl, setImgUrl] = React.useState<string | null>(null)
  const [imgTitle, setImgTitle] = React.useState<string>("")

  const openSelfie = async (title: string, key?: string) => {
    if (!key) {
      toast.error("Selfie tidak tersedia")
      return
    }
    try {
      const blob = await fetchSelfieBlob(key)
      const url = URL.createObjectURL(blob)
      setImgTitle(title)
      setImgUrl(url)
      setImgOpen(true)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal memuat selfie")
    }
  }

  React.useEffect(() => {
    if (!imgOpen && imgUrl) {
      URL.revokeObjectURL(imgUrl)
      setImgUrl(null)
    }
  }, [imgOpen, imgUrl])

  const exportExcel = () => {
    if (mergedRows.length === 0) {
      toast.error("Tidak ada data")
      return
    }
    const data = mergedRows.map((r) => {
      const dev = pickDevice(r)
      return {
        Tanggal: fmtDateId(r.work_date),
        Nama: r.full_name,
        NRP: r.nrp,
        Satker: r.satker_name,
        "Hari Kerja": r.calendar_day_type
            ? r.calendar_day_type === "HALF_DAY"
                ? "Half Day"
                : r.calendar_day_type === "WORKDAY"
                    ? "Workday"
                    : (r as any).has_duty_schedule
                        ? "Duty"
                        : ""
            : (r as any).has_duty_schedule
                ? "Duty"
                : "",
        "Expected Start": r.expected_start ?? "",
        "Expected End": r.expected_end ?? "",
        "Check In": fmtClock(r.check_in_at, tz),
        "Check Out": fmtClock(r.check_out_at, tz),
        "Status In": statusText(
            (r as any).is_pending_today,
            (r as any).is_missing,
            (r as any).is_missing_in,
            false,
            r.check_in_attendance_leave_type,
            r.check_in_attendance_leave_notes,
            r.check_in_geofence_name,
            { hasDuty: (r as any).has_duty_schedule, hasCheckIn: !!r.check_in_at }
        ),
        "Status Out": statusText(
            (r as any).is_pending_today,
            (r as any).is_missing,
            false,
            (r as any).is_missing_out,
            r.check_out_attendance_leave_type,
            r.check_out_attendance_leave_notes,
            r.check_out_geofence_name,
            { hasDuty: (r as any).has_duty_schedule, hasCheckIn: !!r.check_in_at }
        ),
        "Jarak In (m)": r.check_in_distance_to_fence_m ?? "",
        "Jarak Out (m)": r.check_out_distance_to_fence_m ?? "",
        "Device ID": dev.device_id,
        "Device Name": dev.device_name,
        "Device Model": dev.device_model,
        "Selfie In Key": r.check_in_selfie_object_key ?? "",
        "Selfie Out Key": r.check_out_selfie_object_key ?? "",
        "Tanpa Absen": r.is_missing ? "YA" : "",
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rekap")

    const summarySheet = XLSX.utils.json_to_sheet([
      {
        Periode: `${fmtDateId(from)} s/d ${fmtDateId(to)}`,
        Satker: selectedSatker ? `${selectedSatker.code} - ${selectedSatker.name}` : "",
        User: selectedUser ? `${selectedUser.full_name} (${selectedUser.nrp})` : "",
        "Total Hari Kerja": summary.totalHariKerja,
        Hadir: summary.hadir,
        Telat: summary.telat,
        "Lupa Check-In": summary.lupaCheckIn,
        "Lupa Check-Out": summary.lupaCheckOut,
        "Tanpa Absen": summary.tanpaAbsen,
        "Dinas Luar": summary.dinasLuar,
        WFA: summary.wfa,
        WFH: summary.wfh,
        Izin: summary.izin,
        Sakit: summary.sakit,
        Cuti: summary.cuti,
      },
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary")
    const fname = `rekap_absensi_${from}_to_${to}.xlsx`
    XLSX.writeFile(wb, fname)
  }

  const exportPdf = () => {
    if (mergedRows.length === 0) {
      toast.error("Tidak ada data")
      return
    }
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(12)
    doc.text(`Rekap Absensi`, 14, 12)
    doc.setFontSize(10)
    doc.text(`Periode: ${fmtDateId(from)} s/d ${fmtDateId(to)}`, 14, 18)
    if (selectedSatker) doc.text(`Satker: ${selectedSatker.code} - ${selectedSatker.name}`, 14, 23)
    if (selectedUser) doc.text(`User: ${selectedUser.full_name} (${selectedUser.nrp})`, 14, 28)
    doc.text(
        `Ringkasan: Hadir ${summary.hadir}, Telat ${summary.telat}, Lupa Check-In ${summary.lupaCheckIn}, Lupa Check-Out ${summary.lupaCheckOut}, Tanpa Absen ${summary.tanpaAbsen}, Dinas Luar ${summary.dinasLuar}, WFA ${summary.wfa}, WFH ${summary.wfh}, Izin ${summary.izin}, Sakit ${summary.sakit}, Cuti ${summary.cuti}`,
        14,
        33
    )
    doc.setFontSize(10)

    const body = mergedRows.map((r) => {
      const dev = pickDevice(r)
      const sIn = pdfStatusIn(r, tz)
      const sOut = pdfStatusOut(r)
      return [
        fmtDateId(r.work_date),
        r.full_name,
        r.nrp,
        r.satker_name,
        fmtClock(r.check_in_at, tz),
        fmtClock(r.check_out_at, tz),
        pdfStatusCellText(sIn),
        pdfStatusCellText(sOut),
        r.check_in_distance_to_fence_m?.toFixed?.(1) ?? "",
        r.check_out_distance_to_fence_m?.toFixed?.(1) ?? "",
        dev.device_id,
        dev.device_name,
        dev.device_model,
      ]
    })

    autoTable(doc, {
      startY: 38,
      head: [[
        "Tanggal",
        "Nama",
        "NRP",
        "Satker",
        "Check In",
        "Check Out",
        "Status In",
        "Status Out",
        "Jarak In",
        "Jarak Out",
        "Device ID",
        "Device Name",
        "Device Model",
      ]],
      body,
      styles: { fontSize: 7 },
      headStyles: { fontSize: 7 },
      didParseCell: (data) => {
        const col = data.column.index
        // Status In=6, Status Out=7 (0-based)
        if (col === 6 || col === 7) {
          const raw = String(data.cell.raw ?? "")
          const kind = raw.split(/\n/)[0] || ""
          const fill = pdfFillForKind(kind)
          if (fill) {
            data.cell.styles.fillColor = fill
          }
        }
      },
    })

    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 190
    const signY = Math.min(finalY, 190)
    const pageW = doc.internal.pageSize.getWidth()
    const rightX = pageW - 70
    const today = ymdLocal(new Date())
    doc.setFontSize(10)
    doc.text(`Tanggal cetak: ${fmtDateId(today)}`, 14, signY)
    doc.text("Mengetahui,", rightX, signY)
    doc.text("Kepala Satker", rightX, signY + 6)
    doc.text("(________________________)", rightX, signY + 28)
    if (kepalaSatkerName) doc.text(kepalaSatkerName, rightX, signY + 34)

    doc.save(`rekap_absensi_${from}_to_${to}.pdf`)
  }

  return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Rekap Absensi</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportExcel} disabled={!userId || mergedRows.length === 0}>
              Export Excel
            </Button>
            <Button variant="secondary" onClick={exportPdf} disabled={!userId || mergedRows.length === 0}>
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Satker</Label>
              <SatkerSelect
                  value={satkerId}
                  onChange={setSatkerId}
                  items={satkers ?? []}
                  disabled={role === "SATKER_ADMIN" || role === "SATKER_HEAD"}
              />
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userId} onValueChange={setUserId} disabled={!satkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} ({u.nrp})
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bulan</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="show-today" checked={showToday} onCheckedChange={setShowToday} />
            <Label htmlFor="show-today" className="cursor-pointer">
              Tampilkan hari ini
            </Label>
            <span className="text-xs text-muted-foreground">
            (Hari ini tidak dihitung sebagai “Tanpa Absen”)
          </span>
          </div>

          <div className="text-sm text-muted-foreground">
            Default range adalah bulan berjalan. Disarankan rekap per bulan agar laporan lebih rapi.
          </div>

          {!userId ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                Pilih <b>User</b> terlebih dahulu untuk menampilkan rekap. (Saat ganti Satker, user akan dikosongkan agar tidak membingungkan.)
              </div>
          ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Hari Kerja: {summary.totalHariKerja}</Badge>
                  <Badge variant="secondary">Hadir: {summary.hadir}</Badge>
                  <Badge variant="secondary">Telat: {summary.telat}</Badge>
                  <Badge variant="secondary">Lupa Check-In: {summary.lupaCheckIn}</Badge>
                  <Badge variant="secondary">Lupa Check-Out: {summary.lupaCheckOut}</Badge>
                  <Badge variant="secondary">Tanpa Absen: {summary.tanpaAbsen}</Badge>
                  <Badge variant="secondary">Dinas Luar: {summary.dinasLuar}</Badge>
                  <Badge variant="secondary">WFA: {summary.wfa}</Badge>
                  <Badge variant="secondary">WFH: {summary.wfh}</Badge>
                  <Badge variant="secondary">Izin: {summary.izin}</Badge>
                  <Badge variant="secondary">Sakit: {summary.sakit}</Badge>
                  <Badge variant="secondary">Cuti: {summary.cuti}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Belum Absen (hari ini)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Tanpa Absen
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Masuk/Pulang Tidak Absen
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Pulang Cepat
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Telat
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Dinas Luar
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> WFA/WFH
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Izin
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Sakit
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> Cuti
                  </div>
                </div>

                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                  <TabsList>
                    <TabsTrigger value="table">Tabel</TabsTrigger>
                    <TabsTrigger value="calendar">Kalender</TabsTrigger>
                  </TabsList>

                  <TabsContent value="table">
                    <RecapTableView
                        tz={tz}
                        recapQ={recapQ}
                        workingDaysQ={workingDaysQ}
                        mergedRows={mergedRows}
                        fmtDateId={fmtDateId}
                        fmtClock={fmtClock}
                        pickDevice={pickDevice}
                        recapIndicator={recapIndicator}
                        renderStatusIn={renderStatusIn}
                        renderStatusOut={renderStatusOut}
                        openSelfie={openSelfie}
                        onPickDay={(ymd) => {
                          setDayYmd(ymd)
                          setDayOpen(true)
                        }}
                    />
                  </TabsContent>

                  <TabsContent value="calendar">
                    <RecapCalendarView
                        calendar={calendar}
                        calendarCellClass={calendarCellClass}
                        onPickDay={(ymd) => {
                          setDayYmd(ymd)
                          setDayOpen(true)
                        }}
                    />
                  </TabsContent>
                </Tabs>
              </>
          )}
        </CardContent>

        <Dialog open={imgOpen} onOpenChange={setImgOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{imgTitle}</DialogTitle>
            </DialogHeader>
            {imgUrl ? (
                <img src={imgUrl} alt={imgTitle} className="w-full rounded-md" />
            ) : (
                <div className="text-sm text-muted-foreground">Memuat...</div>
            )}
          </DialogContent>
        </Dialog>

        <RecapDayDetailDialog
            open={dayOpen}
            onOpenChange={setDayOpen}
            dayYmd={dayYmd}
            tz={tz}
            fmtDateId={fmtDateId}
            fmtClock={fmtClock}
            selectedDayInfo={selectedDayInfo}
            statusBadgeNode={statusBadgeNode}
            selectedDayRow={selectedDayRow}
            statusOrFence={statusOrFence}
            pickDevice={pickDevice}
            openSelfie={openSelfie}
        />
      </Card>
  )
}


/*
import * as React from "react"
import { toast } from "sonner"

import { getSession } from "@/lib/auth"

import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useUsers } from "@/features/users/hooks"
import { useTimezoneQuery } from "@/features/settings/hooks"

import { useAttendanceRecap } from "@/features/attendance/hooks"
import { fetchSelfieBlob } from "@/features/attendance/api"
import type { AttendanceLeaveType, AttendanceRekapRow } from "@/features/attendance/types"

import { useWorkingDays } from "@/features/working-days/hooks"
import { useSatkerHeads } from "@/features/satker-head/hooks"
import type { WorkingDay } from "@/features/working-days/types"

import { useDutySchedules } from "@/features/duty-schedules/hooks"
import type { DutyScheduleDto } from "@/features/duty-schedules/types"

import { useLeaveRequests } from "@/features/leave-requests/hooks"
import type { LeaveRequestDto, LeaveType } from "@/features/leave-requests/types"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { RecapTableView } from "@/pages/attendance/recap/RecapTableView"
import { RecapCalendarView } from "@/pages/attendance/recap/RecapCalendarView"
import { RecapDayDetailDialog } from "@/pages/attendance/recap/RecapDayDetailDialog"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

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

function ymdInTz(d: Date, tz: string) {
  // en-CA yields YYYY-MM-DD
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    return ymdLocal(d)
  }
}

function addDaysYmd(ymd: string, days: number) {
  // Safe date math in UTC; input is YYYY-MM-DD
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, "0")
  const day = String(d.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function tzOffset(tz: string): string {
  if (tz === "Asia/Jayapura") return "+09:00"
  if (tz === "Asia/Makassar") return "+08:00"
  return "+07:00" // Asia/Jakarta default
}

function isoFromDateTime(dateYmd: string, timeHm: string, tz: string): string {
  // Example: 2026-01-19T00:00:00+08:00
  return `${dateYmd}T${timeHm}:00${tzOffset(tz)}`
}

function isoToYmdInTz(iso: string, tz: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d)
  } catch {
    return ""
  }
}

function monthValueInTz(d: Date, tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
    }).formatToParts(d)
    const y = parts.find((p) => p.type === "year")?.value
    const m = parts.find((p) => p.type === "month")?.value
    if (!y || !m) return toMonthValue(d)
    return `${y}-${m}`
  } catch {
    return toMonthValue(d)
  }
}

function fmtDateId(ymd?: string) {
  if (!ymd) return ""
  try {
    // Treat as calendar date (avoid timezone shifting)
    const d = new Date(`${ymd}T00:00:00`)
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d)
  } catch {
    return ymd
  }
}

function fmtClock(isoUtc?: string, tz?: string) {
  if (!isoUtc) return ""
  try {
    const d = new Date(isoUtc)
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: tz ?? "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(d)
  } catch {
    return isoUtc
  }
}

function timeStrToSeconds(t: string) {
  // HH:MM or HH:MM:SS
  const parts = t.split(":")
  const h = Number(parts[0] ?? 0)
  const m = Number(parts[1] ?? 0)
  const s = Number(parts[2] ?? 0)
  return h * 3600 + m * 60 + s
}

function clockFromIsoInTz(isoUtc: string, tz: string) {
  // Return HH:MM:SS in tz
  const d = new Date(isoUtc)
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d)
  const hh = parts.find((p) => p.type === "hour")?.value ?? "00"
  const mm = parts.find((p) => p.type === "minute")?.value ?? "00"
  const ss = parts.find((p) => p.type === "second")?.value ?? "00"
  return `${hh}:${mm}:${ss}`
}

function calcEarlyOut(expectedEnd: string | null | undefined, checkOutIsoUtc: string | null | undefined, tz: string) {
  if (!expectedEnd || !checkOutIsoUtc) return { isEarlyOut: false, earlyOutMinutes: 0 }
  const expectedSec = timeStrToSeconds(expectedEnd)
  const actualClock = clockFromIsoInTz(checkOutIsoUtc, tz)
  const actualSec = timeStrToSeconds(actualClock)
  const diffSec = expectedSec - actualSec
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin > 0) return { isEarlyOut: true, earlyOutMinutes: diffMin }
  return { isEarlyOut: false, earlyOutMinutes: 0 }
}

function timeStrToMinutes(v?: string | null) {
  if (!v) return null
  const parts = v.split(":")
  if (parts.length < 2) return null
  const hh = parseInt(parts[0], 10)
  const mm = parseInt(parts[1], 10)
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null
  return hh * 60 + mm
}

function isoUtcToMinutesInTz(isoUtc?: string, tz?: string) {
  if (!isoUtc) return null
  try {
    const d = new Date(isoUtc)
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz ?? "Asia/Jakarta",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    })
    const parts = fmt.formatToParts(d)
    const hh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "", 10)
    const mm = parseInt(parts.find((p) => p.type === "minute")?.value ?? "", 10)
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null
    return hh * 60 + mm
  } catch {
    return null
  }
}

function leaveLabel(t?: AttendanceLeaveType) {
  if (!t) return ""
  switch (t) {
    case "NORMAL":
      return "Normal"
    case "DINAS_LUAR":
      return "Dinas Luar"
    case "WFA":
      return "WFA"
    case "WFH":
      return "WFH"
    case "IJIN":
      return "Izin"
    case "SAKIT":
      return "Sakit"
    case "CUTI":
      return "Cuti"
    default:
      return t
  }
}

function mapLeaveTypeToAttendanceLeaveType(t: LeaveType): AttendanceLeaveType {
  switch (t) {
    case "IJIN":
      return "IJIN"
    case "SAKIT":
      return "SAKIT"
    case "DINAS_LUAR":
      return "DINAS_LUAR"
    case "CUTI":
      return "CUTI"
    default:
      return "IJIN"
  }
}

function statusOrFence(
    leaveType: AttendanceLeaveType | undefined,
    notes: string | undefined,
    geofenceName: string | undefined
) {
  if (!leaveType || leaveType === "NORMAL") {
    return geofenceName ?? ""
  }
  const base = leaveLabel(leaveType)
  return notes ? `${base} - ${notes}` : base
}

function pickDevice(r: AttendanceRekapRow) {
  return {
    device_id: r.check_in_device_id ?? r.check_out_device_id ?? "",
    device_name: r.check_in_device_name ?? r.check_out_device_name ?? "",
    device_model: r.check_in_device_model ?? r.check_out_device_model ?? "",
  }
}

function statusText(
    isPendingToday: boolean | undefined,
    isMissing: boolean | undefined,
    isMissingIn: boolean | undefined,
    isMissingOut: boolean | undefined,
    leaveType: AttendanceLeaveType | undefined,
    notes: string | undefined,
    geofenceName: string | undefined
) {
  if (isPendingToday && !leaveType) return "Belum Absen"
  if (isMissingIn && !leaveType) return "Masuk Tidak Absen"
  if (isMissingOut && !leaveType) return "Pulang Tidak Absen"
  if (isMissing && !leaveType) return "Tanpa Absen"
  return statusOrFence(leaveType, notes, geofenceName)
}

function recapIndicator(r: any, tz: string): { label: string; dotClass: string } | null {
  // NOTE: sebelumnya kita warnai full-row, tapi itu bikin teks susah dibaca.
  // Sekarang indikator warna dipindah ke kolom Nama/NRP (dot kecil).

  // 0) Today pending (monitoring)
  if (r?.is_pending_today) return { label: "Belum Absen", dotClass: "bg-slate-400" }

  // 1) Missing attendance
  if (r?.is_missing) return { label: "Tanpa Absen", dotClass: "bg-red-500" }

  // 1b) Partial attendance
  if (r?.is_missing_in) return { label: "Masuk Tidak Absen", dotClass: "bg-orange-500" }
  if (r?.is_missing_out) return { label: "Pulang Tidak Absen", dotClass: "bg-orange-500" }

  // 2) Non-normal leave / assignment
  const lt: AttendanceLeaveType | undefined = r?.check_in_attendance_leave_type ?? r?.check_out_attendance_leave_type
  if (lt && lt !== "NORMAL") {
    if (lt === "DINAS_LUAR") return { label: "Dinas Luar", dotClass: "bg-blue-500" }
    if (lt === "WFA" || lt === "WFH") return { label: lt === "WFA" ? "WFA" : "WFH", dotClass: "bg-violet-500" }
    if (lt === "IJIN") return { label: "Izin", dotClass: "bg-amber-500" }
    if (lt === "SAKIT") return { label: "Sakit", dotClass: "bg-emerald-500" }
    if (lt === "CUTI") return { label: "Cuti", dotClass: "bg-teal-500" }
    return { label: leaveLabel(lt), dotClass: "bg-slate-500" }
  }

  // 3) Early check-out (only for normal attendance)
  if (r?.is_early_out) return { label: `Pulang Cepat${r?.early_out_minutes ? ` (${r.early_out_minutes}m)` : ""}`, dotClass: "bg-rose-500" }

  // 4) Late (only for normal attendance)
  const expectedMin = timeStrToMinutes(r?.expected_start)
  const inMin = isoUtcToMinutesInTz(r?.check_in_at, tz)
  if (expectedMin != null && inMin != null && inMin > expectedMin) return { label: "Telat", dotClass: "bg-yellow-500" }

  return null
}

type RecapKind =
    | "NORMAL"
    | "TELAT"
    | "TANPA_ABSEN"
    | "BELUM_ABSEN"
    | "MISSING_IN"
    | "MISSING_OUT"
    | "PULANG_CEPAT"
    | "DINAS_LUAR"
    | "WFA"
    | "WFH"
    | "IJIN"
    | "SAKIT"
    | "CUTI"
    | "HOLIDAY"
    | "WEEKEND"

function recapKindFromRow(r: any, tz: string): { kind: RecapKind; label: string; detail?: string } {
  const dutyDetail = r?.has_duty_schedule
      ? `Duty Schedule${r?.duty_schedule_titles ? `: ${r.duty_schedule_titles}` : ""}`
      : undefined

  // Holiday row (from working_days) - no attendance (tanpa duty schedule)
  if (r?.day_type === "HOLIDAY" && !r?.has_duty_schedule) return { kind: "HOLIDAY", label: "Holiday" }

  // Today pending
  if (r?.is_pending_today) return { kind: "BELUM_ABSEN", label: "Belum Absen", detail: dutyDetail }

  // Missing / partial
  if (r?.is_missing_in) return { kind: "MISSING_IN", label: "Masuk Tidak Absen", detail: dutyDetail }
  if (r?.is_missing_out) return { kind: "MISSING_OUT", label: "Pulang Tidak Absen", detail: dutyDetail }
  if (r?.is_missing) return { kind: "TANPA_ABSEN", label: "Tanpa Absen", detail: dutyDetail }

  // Early out
  if (r?.is_early_out) {
    const mins = r?.early_out_minutes
    const base = mins ? `${mins} menit lebih awal` : undefined
    const detail = [base, dutyDetail].filter(Boolean).join(" • ") || undefined
    return { kind: "PULANG_CEPAT", label: "Pulang Cepat", detail }
  }

  // Leave
  const lt: AttendanceLeaveType | undefined = r?.check_in_attendance_leave_type ?? r?.check_out_attendance_leave_type
  if (lt && lt !== "NORMAL") {
    const lbl = leaveLabel(lt)
    const notes = (r?.check_in_attendance_leave_notes ?? r?.check_out_attendance_leave_notes) as string | undefined
    const detail = [notes, dutyDetail].filter(Boolean).join(" • ") || undefined
    return { kind: lt as any, label: lbl, detail }
  }

  // Normal: compute late or show geofence
  const expectedMin = timeStrToMinutes(r?.expected_start)
  const inMin = isoUtcToMinutesInTz(r?.check_in_at, tz)
  const geo = (r?.check_in_geofence_name ?? r?.check_out_geofence_name) as string | undefined
  if (expectedMin != null && inMin != null && inMin > expectedMin) {
    const late = inMin - expectedMin
    const lateStr = late > 0 ? `${late} menit` : undefined
    const detail0 = lateStr ? (geo ? `${lateStr} • ${geo}` : lateStr) : geo
    const detail = [detail0, dutyDetail].filter(Boolean).join(" • ") || undefined
    return { kind: "TELAT", label: "Telat", detail }
  }
  const detail = [geo, dutyDetail].filter(Boolean).join(" • ") || undefined
  return { kind: "NORMAL", label: "Normal", detail }
}

function calendarCellClass(kind: RecapKind) {
  // Use subtle backgrounds so text stays readable.
  switch (kind) {
    case "HOLIDAY":
      return "bg-red-500/15 ring-1 ring-red-500/40"
    case "TANPA_ABSEN":
      return "bg-red-500/10 ring-1 ring-red-500/30"
    case "BELUM_ABSEN":
      return "bg-slate-500/10 ring-1 ring-slate-500/30"
    case "MISSING_IN":
    case "MISSING_OUT":
      return "bg-orange-500/10 ring-1 ring-orange-500/30"
    case "TELAT":
      return "bg-yellow-500/10 ring-1 ring-yellow-500/30"
    case "PULANG_CEPAT":
      return "bg-rose-500/10 ring-1 ring-rose-500/30"
    case "DINAS_LUAR":
      return "bg-blue-500/10 ring-1 ring-blue-500/30"
    case "WFA":
    case "WFH":
      return "bg-violet-500/10 ring-1 ring-violet-500/30"
    case "IJIN":
      return "bg-amber-500/10 ring-1 ring-amber-500/30"
    case "SAKIT":
      return "bg-emerald-500/10 ring-1 ring-emerald-500/30"
    case "CUTI":
      return "bg-teal-500/10 ring-1 ring-teal-500/30"
    case "WEEKEND":
      return "bg-muted/40"
    default:
      return "bg-background"
  }
}

function statusBadgeClass(kind: string) {
  // small accent without changing row background (keeps text readable)
  switch (kind) {
    case "Tanpa Absen":
      return "border-red-500 text-red-600"
    case "Telat":
      return "border-yellow-500 text-yellow-700"
    case "Masuk Tidak Absen":
    case "Pulang Tidak Absen":
      return "border-orange-500 text-orange-700"
    case "Pulang Cepat":
      return "border-rose-500 text-rose-700"
    case "Dinas Luar":
      return "border-blue-500 text-blue-600"
    case "WFA":
    case "WFH":
      return "border-violet-500 text-violet-600"
    case "Izin":
      return "border-amber-500 text-amber-700"
    case "Sakit":
      return "border-emerald-500 text-emerald-600"
    case "Cuti":
      return "border-teal-500 text-teal-600"
    case "Belum Absen":
      return "border-slate-400 text-slate-600"
    case "Normal":
    default:
      return "border-slate-300 text-slate-700"
  }
}

function statusBadgeNode(kind: string, detail?: string) {
  return (
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={`text-xs ${statusBadgeClass(kind)}`}>
          {kind}
        </Badge>
        {detail ? <span className="text-xs text-muted-foreground">{detail}</span> : null}
      </div>
  )
}

function renderStatusIn(r: any, tz: string) {
  if (r?.is_pending_today) return statusBadgeNode("Belum Absen")
  if (r?.is_missing_in) return statusBadgeNode("Masuk Tidak Absen")
  if (r?.is_missing) return statusBadgeNode("Tanpa Absen")
  if (r?.is_missing_in) return statusBadgeNode("Masuk Tidak Absen")

  const leaveType: AttendanceLeaveType | undefined = r?.check_in_attendance_leave_type
  if (leaveType && leaveType !== "NORMAL") {
    const kind = leaveLabel(leaveType)
    const detail = r?.check_in_attendance_leave_notes || undefined
    return statusBadgeNode(kind, detail)
  }

  // Normal → show geofence name. Add "Telat" badge if check-in time > expected.
  const expectedMin = timeStrToMinutes(r?.expected_start)
  const inMin = isoUtcToMinutesInTz(r?.check_in_at, tz)
  const isLate = expectedMin != null && inMin != null && inMin > expectedMin
  const fence = r?.check_in_geofence_name || ""
  return statusBadgeNode(isLate ? "Telat" : "Normal", fence)
}

function renderStatusOut(r: any) {
  if (r?.is_pending_today) return statusBadgeNode("Belum Absen")
  if (r?.is_missing_out) return statusBadgeNode("Pulang Tidak Absen")
  if (r?.is_missing) return statusBadgeNode("Tanpa Absen")

  const leaveType: AttendanceLeaveType | undefined = r?.check_out_attendance_leave_type
  if (leaveType && leaveType !== "NORMAL") {
    const kind = leaveLabel(leaveType)
    const detail = r?.check_out_attendance_leave_notes || undefined
    return statusBadgeNode(kind, detail)
  }

  // Early out (only for normal attendance)
  if (r?.is_early_out) {
    const mins = r?.early_out_minutes
    const detail = mins ? `${mins} menit lebih awal` : undefined
    return statusBadgeNode("Pulang Cepat", detail)
  }

  const fence = r?.check_out_geofence_name || ""
  return statusBadgeNode("Normal", fence)
}

// === PDF helpers (make Status In/Out clear in exported PDF) ===
type PdfStatus = { kind: string; detail?: string; manual?: boolean; manual_note?: string }

function _pdfAttachManual(s: PdfStatus, r: any): PdfStatus {
  if (!r?.is_manual) return s
  return { ...s, manual: true, manual_note: r?.manual_note || undefined }
}

function pdfStatusIn(r: any, tz: string): PdfStatus {
  if (r?.is_pending_today) return _pdfAttachManual({ kind: "Belum Absen" }, r)
  if (r?.is_missing_in) return _pdfAttachManual({ kind: "Masuk Tidak Absen" }, r)
  if (r?.is_missing) return _pdfAttachManual({ kind: "Tanpa Absen" }, r)

  const leaveType: AttendanceLeaveType | undefined = r?.check_in_attendance_leave_type
  if (leaveType && leaveType !== "NORMAL") {
    return _pdfAttachManual({ kind: leaveLabel(leaveType), detail: r?.check_in_attendance_leave_notes || undefined }, r)
  }

  const expectedMin = timeStrToMinutes(r?.expected_start)
  const inMin = isoUtcToMinutesInTz(r?.check_in_at, tz)
  const isLate = expectedMin != null && inMin != null && inMin > expectedMin
  const fence = r?.check_in_geofence_name || ""
  return _pdfAttachManual({ kind: (isLate ? "Telat" : "Normal"), detail: fence || undefined, manual: !!r?.is_manual, manual_note: r?.manual_note || undefined }, r)
}



function pdfStatusOut(r: any): PdfStatus {
  if (r?.is_pending_today) return _pdfAttachManual({ kind: "Belum Absen" }, r)
  if (r?.is_missing_out) return _pdfAttachManual({ kind: "Pulang Tidak Absen" }, r)
  if (r?.is_missing) return _pdfAttachManual({ kind: "Tanpa Absen" }, r)

  const leaveType: AttendanceLeaveType | undefined = r?.check_out_attendance_leave_type
  if (leaveType && leaveType !== "NORMAL") {
    return _pdfAttachManual({ kind: leaveLabel(leaveType), detail: r?.check_out_attendance_leave_notes || undefined }, r)
  }

  if (r?.is_early_out) {
    const mins = r?.early_out_minutes
    return _pdfAttachManual({ kind: "Pulang Cepat", detail: mins ? `${mins} menit lebih awal` : undefined }, r)
  }

  const fence = r?.check_out_geofence_name || ""
  return _pdfAttachManual({ kind: "Normal", detail: fence || undefined }, r)
}

function pdfFillForKind(kind: string): [number, number, number] | null {
  // Light fills so text stays readable in print.
  switch (kind) {
    case "Belum Absen":
      return [245, 245, 245] // light gray
    case "Tanpa Absen":
      return [255, 235, 238] // very light red
    case "Telat":
      return [255, 249, 196] // very light yellow
    case "Pulang Cepat":
      return [255, 240, 245] // very light rose
    case "Masuk Tidak Absen":
    case "Pulang Tidak Absen":
      return [255, 243, 224] // very light orange
    case "Dinas Luar":
      return [227, 242, 253] // very light blue
    case "WFA":
    case "WFH":
      return [243, 229, 245] // very light purple
    case "Izin":
      return [255, 243, 224] // very light orange
    case "Sakit":
      return [232, 245, 233] // very light green
    case "Cuti":
      return [224, 242, 241] // very light teal
    default:
      return null
  }
}

function pdfStatusCellText(s: PdfStatus): string {
  const line1 = s.manual ? `${s.kind} (Manual)` : s.kind
  const arr: string[] = [line1]
  if (s.detail) arr.push(s.detail)
  if (s.manual_note) arr.push(`Alasan: ${s.manual_note}`)
  return arr.join("\n")
}


export default function AttendanceRecapPage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const { data: satkers = [] } = useSatkers()
  const tzQ = useTimezoneQuery()
  const tz = tzQ.data?.timezone ?? "Asia/Jakarta"

  // Rekap ditampilkan sampai HARI SEBELUMNYA (yesterday) agar hari ini / masa depan
  // tidak langsung dianggap "Tanpa Absen".
  const todayYmd = React.useMemo(() => ymdInTz(new Date(), tz), [tz])
  const yesterdayYmd = React.useMemo(() => ymdInTz(new Date(Date.now() - 24 * 60 * 60 * 1000), tz), [tz])
  const currentMonthTz = React.useMemo(() => todayYmd.slice(0, 7), [todayYmd])

  // OFF default: report sampai kemarin. ON: tampilkan hari ini untuk monitoring.
  // Catatan: hari ini tidak pernah dihitung sebagai "Tanpa Absen".
  const [showToday, setShowToday] = React.useState(false)

  // Default tampilan: tabel. Ada opsi kalender.
  const [viewMode, setViewMode] = React.useState<"table" | "calendar">("table")

  // Dialog detail tanggal (untuk tampilan kalender)
  const [dayOpen, setDayOpen] = React.useState(false)
  const [dayYmd, setDayYmd] = React.useState<string>("")

  const [satkerId, setSatkerId] = React.useState<string>(() => {
    if (role === "SATKER_ADMIN" || role === "SATKER_HEAD") return session?.satkerId ?? ""
    return ""
  })

  React.useEffect(() => {
    if (role === "SATKER_ADMIN" || role === "SATKER_HEAD") {
      if (session?.satkerId && satkerId !== session.satkerId) setSatkerId(session.satkerId)
      return
    }
    if (!satkerId && satkers.length > 0) setSatkerId(satkers[0].id)
  }, [role, session?.satkerId, satkerId, satkers])

  const usersQ = useUsers(satkerId)
  const users = usersQ.data ?? []

  const [userId, setUserId] = React.useState<string>("")

  // UX rule:
  // - SUPERADMIN: jangan auto-select user (biar tidak bingung saat ganti satker)
  // - SATKER_ADMIN / SATKER_HEAD: boleh auto-select user pertama
  React.useEffect(() => {
    if (role === "SUPERADMIN") return
    if (!userId && users.length > 0) setUserId(users[0].id)
  }, [role, userId, users])

  // Saat ganti satker (khusus SUPERADMIN), kosongkan user supaya tabel tidak menampilkan data satker sebelumnya.
  React.useEffect(() => {
    if (role !== "SUPERADMIN") return
    setUserId("")
  }, [role, satkerId])

  const [month, setMonth] = React.useState(() => toMonthValue(new Date()))
  const [from, setFrom] = React.useState(() => ymdLocal(firstOfMonth(new Date())))
  const [to, setTo] = React.useState(() => ymdLocal(lastOfMonth(new Date())))

  // Jika admin memilih range yang mencakup hari ini / masa depan, otomatis potong.
  // - showToday=false => maksimal kemarin
  // - showToday=true  => maksimal hari ini
  React.useEffect(() => {
    if (!from || !to) return
    const maxTo = showToday ? todayYmd : yesterdayYmd
    if (to > maxTo) {
      const clipped = maxTo < from ? from : maxTo
      if (clipped !== to) setTo(clipped)
    }
  }, [from, to, todayYmd, yesterdayYmd, showToday])

  // month picker default: set range 1 bulan
  React.useEffect(() => {
    const y = parseInt(month.slice(0, 4), 10)
    const m = parseInt(month.slice(5, 7), 10) - 1
    if (Number.isNaN(y) || Number.isNaN(m)) return
    const d = new Date(y, m, 1)
    const fromYmd = ymdLocal(firstOfMonth(d))
    const toMonthEnd = ymdLocal(lastOfMonth(d))
    // Kalau bulan yang dipilih adalah bulan berjalan (di timezone settings),
    // maka batas akhir = kemarin (default) atau hari ini (jika showToday=true).
    const cap = showToday ? todayYmd : yesterdayYmd
    const effectiveTo =
        month === currentMonthTz
            ? cap < fromYmd
                ? fromYmd
                : cap < toMonthEnd
                    ? cap
                    : toMonthEnd
            : toMonthEnd
    setFrom(fromYmd)
    setTo(effectiveTo)
  }, [month, currentMonthTz, yesterdayYmd, todayYmd, showToday])

  const query = React.useMemo(() => {
    if (!userId || !from || !to) return null
    return { from, to, user_id: userId }
  }, [from, to, userId])

  const recapQ = useAttendanceRecap(query ?? { from: "1970-01-01", to: "1970-01-01", user_id: "" }, Boolean(query))
  const rows: AttendanceRekapRow[] = recapQ.data ?? []

  // Leave yang sudah di-APPROVED oleh Head Satker (atau Superadmin) juga ditampilkan di rekap.
  // Kita fetch leave by range, lalu filter per user + satker di client.
  const leaveQ = useLeaveRequests({ from, to }, Boolean(userId && from && to))
  const leaveRows: LeaveRequestDto[] = leaveQ.data?.data ?? []

  const workingDaysQ = useWorkingDays(
      { satkerId, from, to },
      Boolean(satkerId && from && to && userId)
  )
  const workingDays: WorkingDay[] = workingDaysQ.data ?? []

  // Duty schedule (jadwal dinas) perlu ikut tampil di rekap, termasuk saat holiday.
  const dutyQuery = React.useMemo(() => {
    if (!userId || !from || !to) return null
    const fromIso = isoFromDateTime(from, "00:00", tz)
    const toIso = isoFromDateTime(addDaysYmd(to, 1), "00:00", tz) // exclusive
    return { from: fromIso, to: toIso, user_id: userId, satker_id: satkerId || undefined }
  }, [userId, from, to, tz, satkerId])
  const dutyQ = useDutySchedules(
      dutyQuery ?? { from: "1970-01-01T00:00:00+00:00", to: "1970-01-02T00:00:00+00:00" },
      Boolean(dutyQuery)
  )
  const dutyRows: DutyScheduleDto[] = (dutyQ.data?.data ?? []) as DutyScheduleDto[]

  const satkerHeadsQ = useSatkerHeads()
  const satkerHeads = satkerHeadsQ.data ?? []

  const selectedUser = users.find((u) => u.id === userId)
  const selectedSatker = satkers.find((s) => s.id === satkerId)

  type RecapRowEx = AttendanceRekapRow & {
    is_missing?: boolean
    is_missing_in?: boolean
    is_missing_out?: boolean
    is_pending_today?: boolean
    calendar_day_type?: "WORKDAY" | "HALF_DAY" | "HOLIDAY"
    expected_start?: string | null
    expected_end?: string | null
    is_early_out?: boolean
    early_out_minutes?: number
    has_duty_schedule?: boolean
    duty_schedule_titles?: string
  }

  const mergedRows: RecapRowEx[] = React.useMemo(() => {
    if (!userId) return []
    if (!from || !to) return rows as RecapRowEx[]

    const byDate = new Map<string, AttendanceRekapRow>()
    for (const r of rows) byDate.set(r.work_date, r)

    const wdByDate = new Map<string, WorkingDay>()
    for (const w of workingDays) wdByDate.set(w.work_date, w)

    // Map approved leave per-date for selected user.
    // Priority: APPROVED leave overrides "Tanpa Absen" for that day.
    const leaveByDate = new Map<string, LeaveRequestDto>()
    for (const lr of leaveRows) {
      if (lr.status !== "APPROVED") continue
      if (lr.user_id !== userId) continue
      // SUPERADMIN bisa dapat data semua satker, jadi filter satker juga.
      if (satkerId && lr.satker_id !== satkerId) continue

      let cur = lr.start_date
      // clamp to selected range
      if (cur < from) cur = from
      const end = lr.end_date > to ? to : lr.end_date
      while (cur <= end) {
        // Jika ada multiple leave menimpa hari yang sama, keep yang pertama.
        if (!leaveByDate.has(cur)) leaveByDate.set(cur, lr)
        cur = addDaysYmd(cur, 1)
      }
    }

    // Map duty schedule per-date for selected user.
    // - Jadi kalau hari tersebut (termasuk holiday) punya jadwal dinas,
    //   tetap ikut tampil di rekap.
    const dutyByDate = new Map<string, DutyScheduleDto[]>()
    for (const ds of dutyRows) {
      if (ds.user_id !== userId) continue
      // superadmin bisa dapat data semua satker (jaga-jaga)
      if (satkerId && ds.satker_id !== satkerId) continue

      const startYmd = isoToYmdInTz(ds.start_at, tz)
      const endYmd = isoToYmdInTz(ds.end_at, tz)
      if (!startYmd || !endYmd) continue
      let cur = startYmd
      const end = endYmd > to ? to : endYmd
      if (cur < from) cur = from
      while (cur <= end) {
        const arr = dutyByDate.get(cur) ?? []
        arr.push(ds)
        dutyByDate.set(cur, arr)
        cur = addDaysYmd(cur, 1)
      }
    }

    // Generate rows for calendar WORKDAY/HALF_DAY, dan HOLIDAY jika ada duty schedule.
    const out: RecapRowEx[] = []
    for (const [date, w] of wdByDate.entries()) {
      // Masa depan tidak pernah ditampilkan.
      if (date > todayYmd) continue
      // Hari ini hanya tampil jika showToday=true.
      if (date === todayYmd && !showToday) continue
      const duties = dutyByDate.get(date)
      const hasDuty = !!(duties && duties.length)
      const dutyTitles = hasDuty
          ? Array.from(
              new Set(
                  duties!
                      .map((d) => d.title || d.schedule_type || "DUTY_SCHEDULE")
                      .filter(Boolean)
              )
          ).join(", ")
          : ""

      // Holiday normal tidak perlu tampil di table rekap.
      // Tapi kalau ada duty schedule, wajib tampil.
      const r0 = byDate.get(date)
      const leave0 = leaveByDate.get(date)
      if (w.day_type === "HOLIDAY" && !hasDuty && !r0 && !leave0) continue
      const r = r0
      if (r) {
        const isPast = date < todayYmd
        const ltAny: AttendanceLeaveType | undefined =
            r.check_in_attendance_leave_type ?? r.check_out_attendance_leave_type
        const hasNonNormalLeave = ltAny && ltAny !== "NORMAL"
        // Missing in/out hanya berlaku untuk hari yang sudah lewat dan bukan leave.
        const isMissingIn = isPast && !hasNonNormalLeave && !r.check_in_at && !!r.check_out_at
        const isMissingOut = isPast && !hasNonNormalLeave && !!r.check_in_at && !r.check_out_at
        const { isEarlyOut, earlyOutMinutes } = calcEarlyOut(
            w.expected_end,
            r.check_out_at,
            tz
        )
        out.push({
          ...r,
          has_duty_schedule: hasDuty,
          duty_schedule_titles: dutyTitles,
          is_missing_in: isMissingIn,
          is_missing_out: isMissingOut,
          is_early_out: isPast && !hasNonNormalLeave && !isMissingOut && isEarlyOut,
          early_out_minutes: isPast && !hasNonNormalLeave && !isMissingOut && isEarlyOut ? earlyOutMinutes : 0,
          calendar_day_type: w.day_type,
          expected_start: w.expected_start,
          expected_end: w.expected_end,
        })
      } else {
        // No attendance record.
        // 1) if APPROVED leave exists for this date => show leave
        const leave = leave0
        if (leave) {
          const at = mapLeaveTypeToAttendanceLeaveType(leave.tipe)
          const note = (leave.reason ?? leave.decision_note ?? "") as string
          out.push({
            session_id: `leave-${leave.id}-${date}`,
            work_date: date,
            user_id: userId,
            full_name: selectedUser?.full_name ?? "",
            nrp: selectedUser?.nrp ?? "",
            satker_name: selectedSatker?.name ?? "",
            satker_code: selectedSatker?.code ?? "",
            check_in_attendance_leave_type: at,
            check_out_attendance_leave_type: at,
            check_in_attendance_leave_notes: note,
            check_out_attendance_leave_notes: note,
            has_duty_schedule: hasDuty,
            duty_schedule_titles: dutyTitles,
            calendar_day_type: w.day_type,
            expected_start: w.expected_start,
            expected_end: w.expected_end,
          })
        } else {
          // 2) Hari ini: jangan pernah dianggap "Tanpa Absen". Tampilkan sebagai "Belum Absen".
          const isToday = date === todayYmd
          const isPast = date < todayYmd
          out.push({
            session_id: `${isToday ? "pending" : "missing"}-${userId}-${date}`,
            work_date: date,
            user_id: userId,
            full_name: selectedUser?.full_name ?? "",
            nrp: selectedUser?.nrp ?? "",
            satker_name: selectedSatker?.name ?? "",
            satker_code: selectedSatker?.code ?? "",
            // Jika ada duty schedule, maka holiday pun bisa dianggap tanpa absen.
            is_missing: !isToday && (w.day_type !== "HOLIDAY" || hasDuty) && isPast,
            is_pending_today: isToday,
            has_duty_schedule: hasDuty,
            duty_schedule_titles: dutyTitles,
            calendar_day_type: w.day_type,
            expected_start: w.expected_start,
            expected_end: w.expected_end,
          })
        }
      }
    }

    // If calendar not generated, fallback to raw rows (tetap filter sampai kemarin).
    if (out.length === 0) {
      // Jika calendar belum di-generate, fallback ke raw rows:
      // - masa depan tidak tampil
      // - hari ini tampil hanya jika showToday=true
      const base = (rows as RecapRowEx[])
          .filter((r) => (showToday ? r.work_date <= todayYmd : r.work_date < todayYmd))
          .map((r) => {
            const isPast = r.work_date < todayYmd
            const ltAny: AttendanceLeaveType | undefined =
                r.check_in_attendance_leave_type ?? r.check_out_attendance_leave_type
            const hasNonNormalLeave = ltAny && ltAny !== "NORMAL"
            const isMissingIn = isPast && !hasNonNormalLeave && !r.check_in_at && !!r.check_out_at
            const isMissingOut = isPast && !hasNonNormalLeave && !!r.check_in_at && !r.check_out_at
            const duties = dutyByDate.get(r.work_date)
            const hasDuty = !!(duties && duties.length)
            const dutyTitles = hasDuty
                ? Array.from(new Set(duties!.map((d) => d.title || d.schedule_type || "DUTY_SCHEDULE").filter(Boolean))).join(", ")
                : ""
            return { ...r, is_missing_in: isMissingIn, is_missing_out: isMissingOut, has_duty_schedule: hasDuty, duty_schedule_titles: dutyTitles }
          })

      // Tambahkan baris untuk tanggal yang punya duty schedule tapi tidak punya attendance record.
      // (khusus saat calendar belum di-generate)
      const existing = new Set(base.map((r) => r.work_date))
      for (const [date, duties] of dutyByDate.entries()) {
        if (!date || date < from || date > to) continue
        if (date > todayYmd) continue
        if (date === todayYmd && !showToday) continue
        if (existing.has(date)) continue

        const dutyTitles = Array.from(
            new Set(duties.map((d) => d.title || d.schedule_type || "DUTY_SCHEDULE").filter(Boolean))
        ).join(", ")

        const isToday = date === todayYmd
        base.push({
          session_id: `${isToday ? "pending" : "missing"}-${userId}-${date}`,
          work_date: date,
          user_id: userId,
          full_name: selectedUser?.full_name ?? "",
          nrp: selectedUser?.nrp ?? "",
          satker_name: selectedSatker?.name ?? "",
          satker_code: selectedSatker?.code ?? "",
          is_missing: !isToday,
          is_pending_today: isToday,
          has_duty_schedule: true,
          duty_schedule_titles: dutyTitles,
        })
      }

      base.sort((a, b) => a.work_date.localeCompare(b.work_date))
      return base
    }

    // Sort by work_date asc
    out.sort((a, b) => a.work_date.localeCompare(b.work_date))
    return out
  }, [from, to, rows, workingDays, dutyRows, tz, leaveRows, satkerId, userId, selectedUser?.full_name, selectedUser?.nrp, selectedSatker?.name, selectedSatker?.code, todayYmd, showToday])

  const mergedByDate = React.useMemo(() => {
    const m = new Map<string, RecapRowEx>()
    for (const r of mergedRows) m.set(r.work_date, r)
    return m
  }, [mergedRows])

  const workingDayByDate = React.useMemo(() => {
    const m = new Map<string, WorkingDay>()
    for (const w of workingDays) m.set(w.work_date, w)
    return m
  }, [workingDays])

  const summary = React.useMemo(() => {
    const s = {
      totalHariKerja: 0,
      hadir: 0,
      telat: 0,
      pulangCepat: 0,
      tanpaAbsen: 0,
      lupaCheckIn: 0,
      lupaCheckOut: 0,
      dinasLuar: 0,
      wfa: 0,
      wfh: 0,
      izin: 0,
      sakit: 0,
      cuti: 0,
    }

    for (const r of mergedRows) {
      // Hari ini (mode monitoring) tidak ikut perhitungan summary agar tidak
      // salah dianggap "tanpa absen" atau mengganggu statistik bulanan.
      if ((r as any).is_pending_today) continue
      // Count only calendar workdays if available.
      if (r.calendar_day_type === "WORKDAY" || r.calendar_day_type === "HALF_DAY") {
        s.totalHariKerja += 1
      }

      const lt = r.check_in_attendance_leave_type ?? r.check_out_attendance_leave_type

      if (!r.check_in_at && !r.check_out_at && !lt) {
        if (r.calendar_day_type === "WORKDAY" || r.calendar_day_type === "HALF_DAY") s.tanpaAbsen += 1
        continue
      }

      if (lt && lt !== "NORMAL") {
        if (lt === "DINAS_LUAR") s.dinasLuar += 1
        if (lt === "WFA") s.wfa += 1
        if (lt === "WFH") s.wfh += 1
        if (lt === "IJIN") s.izin += 1
        if (lt === "SAKIT") s.sakit += 1
        if (lt === "CUTI") s.cuti += 1
        // treat non-normal leave as present (can be adjusted later)
        s.hadir += 1
        continue
      }

      // Normal attendance present
      if (r.check_in_at || r.check_out_at) {
        s.hadir += 1

        if ((r as any).is_missing_in) s.lupaCheckIn += 1
        if ((r as any).is_missing_out) s.lupaCheckOut += 1
        if ((r as any).is_early_out) s.pulangCepat += 1

        const expectedMin = timeStrToMinutes(r.expected_start)
        const inMin = isoUtcToMinutesInTz(r.check_in_at, tz)
        if (expectedMin != null && inMin != null && inMin > expectedMin) {
          s.telat += 1
        }
      }
    }
    return s
  }, [mergedRows, tz])

  const kepalaSatkerName = React.useMemo(() => {
    if (!satkerId) return ""
    const today = ymdLocal(new Date())
    const items = satkerHeads.filter((h) => h.satker_id === satkerId)
    // prefer active today
    const active = items.find((h) => h.active_from <= today && (!h.active_to || h.active_to >= today))
    return (active ?? items[0])?.full_name ?? ""
  }, [satkerHeads, satkerId])

  const calendar = React.useMemo(() => {
    // Render kalender untuk bulan yang dipilih (month picker)
    const y = parseInt(month.slice(0, 4), 10)
    const m = parseInt(month.slice(5, 7), 10) - 1
    const first = new Date(y, m, 1)
    const daysInMonth = new Date(y, m + 1, 0).getDate()

    // Monday as start of week (ID convention)
    const jsDow = first.getDay() // 0=Sun
    const offset = (jsDow + 6) % 7 // 0=Mon

    const cells: Array<{
      ymd: string
      day: number
      inMonth: boolean
      disabled: boolean
      kind: RecapKind
      label: string
      detail?: string
      is_manual?: boolean
    }> = []

    // Fill 6 weeks x 7 days = 42 cells
    for (let idx = 0; idx < 42; idx++) {
      const dayNum = idx - offset + 1
      const inMonth = dayNum >= 1 && dayNum <= daysInMonth
      const d = new Date(y, m, Math.min(Math.max(dayNum, 1), daysInMonth))
      const ymd = ymdLocal(new Date(y, m, dayNum))

      // Determine disabled state: outside month or outside selected range
      const outOfRange = !inMonth || (from && ymd < from) || (to && ymd > to)
      const isWeekend = (() => {
        const dow = new Date(`${ymd}T00:00:00`).getDay()
        return dow === 0 || dow === 6
      })()

      // Determine kind/label
      let kind: RecapKind = isWeekend ? "WEEKEND" : "NORMAL"
      let label = ""
      let detail: string | undefined

      if (inMonth && !outOfRange) {
        const wd = workingDayByDate.get(ymd)
        const r = mergedByDate.get(ymd)
        if (wd?.day_type === "HOLIDAY" && !r) {
          kind = "HOLIDAY"
          label = "Holiday"
        } else if (r) {
          const k = recapKindFromRow(r, tz)
          kind = k.kind
          label = k.label
          detail = k.detail
        } else {
          // Hari kerja tanpa row attendance biasanya sudah ada di mergedRows.
          // Tapi jika calendar belum di-generate lengkap, tetap aman.
          kind = isWeekend ? "WEEKEND" : "NORMAL"
          label = ""
        }
      }

      cells.push({
        ymd,
        day: dayNum,
        inMonth,
        disabled: outOfRange,
        kind,
        label,
        detail,
        is_manual: Boolean((mergedByDate.get(ymd) as any)?.is_manual),
      })
    }

    return { year: y, month: m, cells }
  }, [month, from, to, mergedByDate, workingDayByDate, tz])

  const selectedDayRow = React.useMemo<RecapRowEx | null>(() => {
    if (!dayYmd) return null
    return mergedByDate.get(dayYmd) ?? null
  }, [dayYmd, mergedByDate])

  const selectedDayInfo = React.useMemo(() => {
    if (!dayYmd) return null
    const wd = workingDayByDate.get(dayYmd)
    const r = mergedByDate.get(dayYmd)
    if (wd?.day_type === "HOLIDAY" && !r) {
      return { kind: "HOLIDAY" as RecapKind, label: "Holiday" }
    }
    if (r) return recapKindFromRow(r, tz)
    return { kind: "NORMAL" as RecapKind, label: "Normal" }
  }, [dayYmd, mergedByDate, workingDayByDate, tz])

  const [imgOpen, setImgOpen] = React.useState(false)
  const [imgUrl, setImgUrl] = React.useState<string | null>(null)
  const [imgTitle, setImgTitle] = React.useState<string>("")

  const openSelfie = async (title: string, key?: string) => {
    if (!key) {
      toast.error("Selfie tidak tersedia")
      return
    }
    try {
      const blob = await fetchSelfieBlob(key)
      const url = URL.createObjectURL(blob)
      setImgTitle(title)
      setImgUrl(url)
      setImgOpen(true)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal memuat selfie")
    }
  }

  React.useEffect(() => {
    if (!imgOpen && imgUrl) {
      URL.revokeObjectURL(imgUrl)
      setImgUrl(null)
    }
  }, [imgOpen, imgUrl])

  const exportExcel = () => {
    if (mergedRows.length === 0) {
      toast.error("Tidak ada data")
      return
    }
    const data = mergedRows.map((r) => {
      const dev = pickDevice(r)
      return {
        Tanggal: fmtDateId(r.work_date),
        Nama: r.full_name,
        NRP: r.nrp,
        Satker: r.satker_name,
        "Hari Kerja": r.calendar_day_type ? (r.calendar_day_type === "HALF_DAY" ? "Half Day" : "Workday") : "",
        "Expected Start": r.expected_start ?? "",
        "Expected End": r.expected_end ?? "",
        "Check In": fmtClock(r.check_in_at, tz),
        "Check Out": fmtClock(r.check_out_at, tz),
        "Status In": statusText(
            (r as any).is_pending_today,
            (r as any).is_missing,
            (r as any).is_missing_in,
            false,
            r.check_in_attendance_leave_type,
            r.check_in_attendance_leave_notes,
            r.check_in_geofence_name
        ),
        "Status Out": statusText(
            (r as any).is_pending_today,
            (r as any).is_missing,
            false,
            (r as any).is_missing_out,
            r.check_out_attendance_leave_type,
            r.check_out_attendance_leave_notes,
            r.check_out_geofence_name
        ),
        "Jarak In (m)": r.check_in_distance_to_fence_m ?? "",
        "Jarak Out (m)": r.check_out_distance_to_fence_m ?? "",
        "Device ID": dev.device_id,
        "Device Name": dev.device_name,
        "Device Model": dev.device_model,
        "Selfie In Key": r.check_in_selfie_object_key ?? "",
        "Selfie Out Key": r.check_out_selfie_object_key ?? "",
        "Tanpa Absen": r.is_missing ? "YA" : "",
      }
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Rekap")

    const summarySheet = XLSX.utils.json_to_sheet([
      {
        Periode: `${fmtDateId(from)} s/d ${fmtDateId(to)}`,
        Satker: selectedSatker ? `${selectedSatker.code} - ${selectedSatker.name}` : "",
        User: selectedUser ? `${selectedUser.full_name} (${selectedUser.nrp})` : "",
        "Total Hari Kerja": summary.totalHariKerja,
        Hadir: summary.hadir,
        Telat: summary.telat,
        "Lupa Check-In": summary.lupaCheckIn,
        "Lupa Check-Out": summary.lupaCheckOut,
        "Tanpa Absen": summary.tanpaAbsen,
        "Dinas Luar": summary.dinasLuar,
        WFA: summary.wfa,
        WFH: summary.wfh,
        Izin: summary.izin,
        Sakit: summary.sakit,
        Cuti: summary.cuti,
      },
    ])
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary")
    const fname = `rekap_absensi_${from}_to_${to}.xlsx`
    XLSX.writeFile(wb, fname)
  }

  const exportPdf = () => {
    if (mergedRows.length === 0) {
      toast.error("Tidak ada data")
      return
    }
    const doc = new jsPDF({ orientation: "landscape" })
    doc.setFontSize(12)
    doc.text(`Rekap Absensi`, 14, 12)
    doc.setFontSize(10)
    doc.text(`Periode: ${fmtDateId(from)} s/d ${fmtDateId(to)}`, 14, 18)
    if (selectedSatker) doc.text(`Satker: ${selectedSatker.code} - ${selectedSatker.name}`, 14, 23)
    if (selectedUser) doc.text(`User: ${selectedUser.full_name} (${selectedUser.nrp})`, 14, 28)
    doc.text(
        `Ringkasan: Hadir ${summary.hadir}, Telat ${summary.telat}, Lupa Check-In ${summary.lupaCheckIn}, Lupa Check-Out ${summary.lupaCheckOut}, Tanpa Absen ${summary.tanpaAbsen}, Dinas Luar ${summary.dinasLuar}, WFA ${summary.wfa}, WFH ${summary.wfh}, Izin ${summary.izin}, Sakit ${summary.sakit}, Cuti ${summary.cuti}`,
        14,
        33
    )
    doc.setFontSize(10)

    const body = mergedRows.map((r) => {
      const dev = pickDevice(r)
      const sIn = pdfStatusIn(r, tz)
      const sOut = pdfStatusOut(r)
      return [
        fmtDateId(r.work_date),
        r.full_name,
        r.nrp,
        r.satker_name,
        fmtClock(r.check_in_at, tz),
        fmtClock(r.check_out_at, tz),
        pdfStatusCellText(sIn),
        pdfStatusCellText(sOut),
        r.check_in_distance_to_fence_m?.toFixed?.(1) ?? "",
        r.check_out_distance_to_fence_m?.toFixed?.(1) ?? "",
        dev.device_id,
        dev.device_name,
        dev.device_model,
      ]
    })

    autoTable(doc, {
      startY: 38,
      head: [[
        "Tanggal",
        "Nama",
        "NRP",
        "Satker",
        "Check In",
        "Check Out",
        "Status In",
        "Status Out",
        "Jarak In",
        "Jarak Out",
        "Device ID",
        "Device Name",
        "Device Model",
      ]],
      body,
      styles: { fontSize: 7 },
      headStyles: { fontSize: 7 },
      didParseCell: (data) => {
        const col = data.column.index
        // Status In=6, Status Out=7 (0-based)
        if (col === 6 || col === 7) {
          const raw = String(data.cell.raw ?? "")
          const kind = raw.split(/\n/)[0] || ""
          const fill = pdfFillForKind(kind)
          if (fill) {
            data.cell.styles.fillColor = fill
          }
        }
      },
    })

    const finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 190
    const signY = Math.min(finalY, 190)
    const pageW = doc.internal.pageSize.getWidth()
    const rightX = pageW - 70
    const today = ymdLocal(new Date())
    doc.setFontSize(10)
    doc.text(`Tanggal cetak: ${fmtDateId(today)}`, 14, signY)
    doc.text("Mengetahui,", rightX, signY)
    doc.text("Kepala Satker", rightX, signY + 6)
    doc.text("(________________________)", rightX, signY + 28)
    if (kepalaSatkerName) doc.text(kepalaSatkerName, rightX, signY + 34)

    doc.save(`rekap_absensi_${from}_to_${to}.pdf`)
  }

  return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Rekap Absensi</CardTitle>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={exportExcel} disabled={!userId || mergedRows.length === 0}>
              Export Excel
            </Button>
            <Button variant="secondary" onClick={exportPdf} disabled={!userId || mergedRows.length === 0}>
              Export PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div className="space-y-2">
              <Label>Satker</Label>
              <SatkerSelect
                  value={satkerId}
                  onChange={setSatkerId}
                  items={satkers ?? []}
                  disabled={role === "SATKER_ADMIN" || role === "SATKER_HEAD"}
              />
            </div>

            <div className="space-y-2">
              <Label>User</Label>
              <Select value={userId} onValueChange={setUserId} disabled={!satkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih user" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} ({u.nrp})
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bulan</Label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Switch id="show-today" checked={showToday} onCheckedChange={setShowToday} />
            <Label htmlFor="show-today" className="cursor-pointer">
              Tampilkan hari ini
            </Label>
            <span className="text-xs text-muted-foreground">
            (Hari ini tidak dihitung sebagai “Tanpa Absen”)
          </span>
          </div>

          <div className="text-sm text-muted-foreground">
            Default range adalah bulan berjalan. Disarankan rekap per bulan agar laporan lebih rapi.
          </div>

          {!userId ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                Pilih <b>User</b> terlebih dahulu untuk menampilkan rekap. (Saat ganti Satker, user akan dikosongkan agar tidak membingungkan.)
              </div>
          ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Hari Kerja: {summary.totalHariKerja}</Badge>
                  <Badge variant="secondary">Hadir: {summary.hadir}</Badge>
                  <Badge variant="secondary">Telat: {summary.telat}</Badge>
                  <Badge variant="secondary">Lupa Check-In: {summary.lupaCheckIn}</Badge>
                  <Badge variant="secondary">Lupa Check-Out: {summary.lupaCheckOut}</Badge>
                  <Badge variant="secondary">Tanpa Absen: {summary.tanpaAbsen}</Badge>
                  <Badge variant="secondary">Dinas Luar: {summary.dinasLuar}</Badge>
                  <Badge variant="secondary">WFA: {summary.wfa}</Badge>
                  <Badge variant="secondary">WFH: {summary.wfh}</Badge>
                  <Badge variant="secondary">Izin: {summary.izin}</Badge>
                  <Badge variant="secondary">Sakit: {summary.sakit}</Badge>
                  <Badge variant="secondary">Cuti: {summary.cuti}</Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Belum Absen (hari ini)
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Tanpa Absen
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-orange-500" /> Masuk/Pulang Tidak Absen
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> Pulang Cepat
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-yellow-500" /> Telat
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Dinas Luar
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> WFA/WFH
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Izin
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Sakit
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-teal-500" /> Cuti
                  </div>
                </div>

                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
                  <TabsList>
                    <TabsTrigger value="table">Tabel</TabsTrigger>
                    <TabsTrigger value="calendar">Kalender</TabsTrigger>
                  </TabsList>

                  <TabsContent value="table">
                    <RecapTableView
                        tz={tz}
                        recapQ={recapQ}
                        workingDaysQ={workingDaysQ}
                        mergedRows={mergedRows}
                        fmtDateId={fmtDateId}
                        fmtClock={fmtClock}
                        pickDevice={pickDevice}
                        recapIndicator={recapIndicator}
                        renderStatusIn={renderStatusIn}
                        renderStatusOut={renderStatusOut}
                        openSelfie={openSelfie}
                        onPickDay={(ymd) => {
                          setDayYmd(ymd)
                          setDayOpen(true)
                        }}
                    />
                  </TabsContent>

                  <TabsContent value="calendar">
                    <RecapCalendarView
                        calendar={calendar}
                        calendarCellClass={calendarCellClass}
                        onPickDay={(ymd) => {
                          setDayYmd(ymd)
                          setDayOpen(true)
                        }}
                    />
                  </TabsContent>
                </Tabs>
              </>
          )}
        </CardContent>

        <Dialog open={imgOpen} onOpenChange={setImgOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{imgTitle}</DialogTitle>
            </DialogHeader>
            {imgUrl ? (
                <img src={imgUrl} alt={imgTitle} className="w-full rounded-md" />
            ) : (
                <div className="text-sm text-muted-foreground">Memuat...</div>
            )}
          </DialogContent>
        </Dialog>

        <RecapDayDetailDialog
            open={dayOpen}
            onOpenChange={setDayOpen}
            dayYmd={dayYmd}
            tz={tz}
            fmtDateId={fmtDateId}
            fmtClock={fmtClock}
            selectedDayInfo={selectedDayInfo}
            statusBadgeNode={statusBadgeNode}
            selectedDayRow={selectedDayRow}
            statusOrFence={statusOrFence}
            pickDevice={pickDevice}
            openSelfie={openSelfie}
        />
      </Card>
  )
}


*/
