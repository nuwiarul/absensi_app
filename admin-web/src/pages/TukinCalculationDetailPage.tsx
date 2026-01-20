import * as React from "react"
import dayjs from "dayjs"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { apiErrorMessage } from "@/lib/api-error"
import { useTimezoneQuery } from "@/features/settings/hooks"
import { useTukinCalculations } from "@/features/tukin/hooks"
import type { TukinCalculationRow } from "@/features/tukin/types"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

function Money({ value }: { value: number }) {
    const v = Number.isFinite(value) ? value : 0
    return <span>{new Intl.NumberFormat("id-ID").format(Math.round(v))}</span>
}

function Ratio({ value }: { value: number }) {
    const v = Number.isFinite(value) ? value : 0
    return <span>{(v * 100).toFixed(2)}%</span>
}

function moneyStr(v: number) {
    const n = Number.isFinite(v) ? v : 0
    return new Intl.NumberFormat("id-ID").format(Math.round(n))
}

function fmtIsoYmdHm(isoUtc?: string | null, tz?: string) {
    if (!isoUtc) return "-"
    try {
        const d = new Date(isoUtc)
        const date = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz ?? "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(d)
        const time = new Intl.DateTimeFormat("en-GB", {
            timeZone: tz ?? "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(d)
        return `${date} ${time}`
    } catch {
        return dayjs(isoUtc).format("YYYY-MM-DD HH:mm")
    }
}

function fmtIsoHm(isoUtc?: string | null, tz?: string) {
    if (!isoUtc) return "-"
    try {
        const d = new Date(isoUtc)
        const time = new Intl.DateTimeFormat("en-GB", {
            timeZone: tz ?? "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(d)
        return `${time}`
    } catch {
        return dayjs(isoUtc).format("HH:mm")
    }
}

function formatTanggalID(iso: string, tz: string) {
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeZone: tz,
    }).format(new Date(iso))
}

function formatBulanID(isoMonth: string, tz: string) {
    const date = new Date(`${isoMonth}-01`)
    const formatted = new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
        timeZone: tz,
    }).format(date)
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

type DayRow = {
    work_date?: string
    expected_unit?: number
    earned_credit?: number
    check_in_at?: string | null
    check_out_at?: string | null
    late_minutes?: number | null
    note?: string | null

    // OPTIONAL (kalau backend sudah mulai kirim)
    penalty_pct?: number | null
    penalty_reason?: string | null
}

function noteStr(d: DayRow): string {
    return String(d.note ?? "").trim().toUpperCase()
}

function lateMinutes(d: DayRow): number {
    const v = Number(d.late_minutes ?? 0)
    return Number.isFinite(v) ? v : 0
}

function isMissingCheckout(d: DayRow): boolean {
    const n = noteStr(d)
    return n.includes("MISSING_CHECKOUT") || n.includes("MISSING CHECKOUT")
}

function isOutOfGeofence(d: DayRow): boolean {
    const n = noteStr(d)
    return n.includes("OUT_OF_GEOFENCE") || n.includes("OUT OF GEOFENCE")
}

function isDuty(d: DayRow): boolean {
    const n = noteStr(d)
    return n.includes("DUTY") || n.includes("DINAS")
}

function isHolidayIgnored(d: DayRow): boolean {
    const n = noteStr(d)
    return n.includes("HOLIDAY_IGNORED") || n.includes("HOLIDAY IGNORED")
}

function isHalfday(d: DayRow): boolean {
    const n = noteStr(d)
    return n.includes("HALFDAY") || n.includes("HALF DAY")
}

function isProblemDay(d: DayRow): boolean {
    return isMissingCheckout(d) || isOutOfGeofence(d) || isDuty(d) || lateMinutes(d) > 0
}

function rowClass(d: DayRow) {
    // urutan prioritas
    if (isMissingCheckout(d) || isOutOfGeofence(d)) return "bg-red-500/10"
    if (lateMinutes(d) > 0) return "bg-yellow-500/10"
    if (isDuty(d)) return "bg-blue-500/10"
    if (isHolidayIgnored(d)) return "opacity-70"
    return ""
}

function DayNoteBadge({ d }: { d: DayRow }) {
    const n = noteStr(d)
    if (!n) return null
    if (n.includes("HOLIDAY_IGNORED")) return <Badge variant="outline">HOLIDAY</Badge>
    if (n.includes("DUTY")) return <Badge variant="secondary">DUTY</Badge>
    if (n.includes("OUT_OF_GEOFENCE")) return <Badge variant="destructive">OUT</Badge>
    if (n.includes("MISSING_CHECKOUT")) return <Badge variant="destructive">MISSING</Badge>
    if (n.includes("LATE")) return <Badge variant="outline">LATE</Badge>
    return <Badge variant="outline">NOTE</Badge>
}

function buildReasons(d: DayRow): string[] {
    const reasons: string[] = []
    if (isMissingCheckout(d)) reasons.push("MISSING_CHECKOUT")
    if (isOutOfGeofence(d)) reasons.push("OUT_OF_GEOFENCE")
    if (lateMinutes(d) > 0) reasons.push(`LATE_${lateMinutes(d)}m`)
    if (isDuty(d)) reasons.push("DUTY")
    if (isHalfday(d)) reasons.push("HALFDAY")
    if (isHolidayIgnored(d)) reasons.push("HOLIDAY_IGNORED")

    // jika backend mengirim alasan penalty khusus
    const pr = String(d.penalty_reason ?? "").trim()
    if (pr) reasons.push(pr)

    return reasons
}

function fmtPct(p: number) {
    const v = Number.isFinite(p) ? p : 0
    return `${v.toFixed(2)}%`
}

function getPenaltyDisplay(
    d: DayRow,
    estimatePenalty: boolean
): { text: string; muted?: boolean } | null {
    // 1) kalau backend kirim penalty_pct -> pakai itu
    const p = d.penalty_pct
    if (p !== null && p !== undefined && Number.isFinite(Number(p))) {
        const v = Number(p)
        if (v <= 0) return { text: "-", muted: true }
        return { text: fmtPct(v), muted: false }
    }

    // 2) kalau tidak ada, dan estimasi diminta -> hitung kasar dari flags
    if (!estimatePenalty) return null

    let pct = 0
    if (isDuty(d)) pct = Math.max(pct, 0) // duty biasanya tidak dipotong (sesuaikan bila perlu)
    if (lateMinutes(d) > 0) pct = Math.max(pct, 1) // placeholder minim
    if (isOutOfGeofence(d)) pct = Math.max(pct, 10)
    if (isMissingCheckout(d)) pct = Math.max(pct, 25)

    if (pct <= 0) return { text: "-", muted: true }
    return { text: `${fmtPct(pct)} (estimasi)`, muted: true }
}

export default function TukinCalculationDetailPage() {
    const nav = useNavigate()
    const [sp] = useSearchParams()

    const tzQ = useTimezoneQuery()
    const tz = tzQ.data?.timezone ?? "Asia/Jakarta"

    const month = sp.get("month") ?? ""
    const satkerId = sp.get("satkerId") ?? ""
    const userId = sp.get("userId") ?? ""

    const canQuery = !!month && !!satkerId && !!userId

    const q = useTukinCalculations({
        month,
        satkerId,
        userId,
        enabled: canQuery,
    })

    React.useEffect(() => {
        if (!canQuery) toast.error("Parameter tidak lengkap (month/satkerId/userId)")
    }, [canQuery])

    const row: TukinCalculationRow | null = q.data && q.data.length > 0 ? q.data[0] : null
    const days: DayRow[] = ((row?.breakdown?.days as any[]) ?? []) as DayRow[]

    // =========================
    // INSIGHT CEPAT (COUNTER)
    // =========================
    const stats = React.useMemo(() => {
        let missingCheckout = 0
        let lateDays = 0
        let lateTotalMinutes = 0
        let outGeofence = 0
        let duty = 0
        let holidayIgnored = 0
        let halfday = 0
        let workdayOk = 0

        for (const d of days) {
            const miss = isMissingCheckout(d)
            const lateM = lateMinutes(d)
            const out = isOutOfGeofence(d)
            const du = isDuty(d)
            const hol = isHolidayIgnored(d)
            const half = isHalfday(d)

            if (miss) missingCheckout += 1
            if (lateM > 0) {
                lateDays += 1
                lateTotalMinutes += lateM
            }
            if (out) outGeofence += 1
            if (du) duty += 1
            if (hol) holidayIgnored += 1
            if (half) halfday += 1

            const hasWorkSignal = Number(d.expected_unit ?? 0) > 0 || !!d.check_in_at
            const problem = miss || out || lateM > 0
            if (hasWorkSignal && !hol && !du && !problem) workdayOk += 1
        }

        return {
            missingCheckout,
            lateDays,
            lateTotalMinutes,
            outGeofence,
            duty,
            holidayIgnored,
            halfday,
            workdayOk,
            totalDays: days.length,
        }
    }, [days])

    // =========================
    // FILTER UI
    // =========================
    const [onlyProblem, setOnlyProblem] = React.useState(false)
    const [showHolidayIgnored, setShowHolidayIgnored] = React.useState(false)
    const [qText, setQText] = React.useState("")
    const [estimatePenalty, setEstimatePenalty] = React.useState(false)

    React.useEffect(() => {
        if (onlyProblem) setShowHolidayIgnored(false)
    }, [onlyProblem])

    const filteredDays = React.useMemo(() => {
        const t = qText.trim().toUpperCase()

        return days.filter((d) => {
            if (onlyProblem && !isProblemDay(d)) return false
            if (!showHolidayIgnored && isHolidayIgnored(d)) return false

            if (!t) return true
            const hay = `${d.work_date ?? ""} ${noteStr(d)} ${d.check_in_at ?? ""} ${d.check_out_at ?? ""}`.toUpperCase()
            return hay.includes(t)
        })
    }, [days, onlyProblem, showHolidayIgnored, qText])

    // =========================
    // EXPORT (XLSX + PDF)
    // =========================
    const exportExcel = () => {
        if (!row) return toast.error("Data tidak ditemukan")
        if (!filteredDays || filteredDays.length === 0) return toast.error("Tidak ada data untuk diexport (sesuai filter)")

        const summary = [
            {
                Periode: formatBulanID(month, tz),
                Satker: `${row.satker_code ?? ""} - ${row.satker_name ?? ""}`.trim(),
                Nama: row.user_full_name,
                NRP: row.user_nrp,
                Base: row.base_tukin,
                Expected: row.expected_units,
                Earned: Number(row.earned_credit ?? 0),
                "Ratio (%)": Number((Number(row.attendance_ratio ?? 0) * 100).toFixed(2)),
                Final: row.final_tukin,
                "Filter: Only Problem": onlyProblem ? "YA" : "TIDAK",
                "Filter: Show Holiday": showHolidayIgnored ? "YA" : "TIDAK",
                "Filter: Search": qText.trim() ? qText.trim() : "-",
                "Rows Exported": filteredDays.length,
            },
        ]

        const daysSheet = filteredDays.map((d, idx) => {
            const reasons = buildReasons(d).join(" | ")
            const penalty = getPenaltyDisplay(d, estimatePenalty)?.text ?? "-"
            return {
                No: idx + 1,
                "Work Date": d.work_date ?? "",
                Tanggal: d.work_date ? formatTanggalID(d.work_date, tz) : "",
                Expected: Number(d.expected_unit ?? 0),
                Earned: Number(d.earned_credit ?? 0),
                "Check In": fmtIsoYmdHm(d.check_in_at ?? null, tz),
                "Check Out": fmtIsoYmdHm(d.check_out_at ?? null, tz),
                "Late Minutes": d.late_minutes ?? 0,
                Penalty: penalty,
                Reason: reasons || "-",
                Note: (d.note ?? "") || "",
            }
        })

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), "Summary")
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(daysSheet), "Days")

        const satkerCode = row.satker_code ?? "SATKER"
        const fname = `tukin_detail_${month}_${satkerCode}_${row.user_nrp}.xlsx`.replace(/[^\w.-]+/g, "_")
        XLSX.writeFile(wb, fname)
    }

    const exportPdf = () => {
        if (!row) return toast.error("Data tidak ditemukan")
        if (!filteredDays || filteredDays.length === 0) return toast.error("Tidak ada data untuk diexport (sesuai filter)")

        const doc = new jsPDF({ orientation: "landscape" })

        // Header
        doc.setFontSize(12)
        doc.text("Detail Tukin Bulanan", 14, 12)

        doc.setFontSize(10)
        doc.text(`Periode: ${formatBulanID(month, tz)}`, 14, 18)
        doc.text(`Satker: ${row.satker_code} - ${row.satker_name ?? ""}`, 14, 23)
        doc.text(`User: ${row.user_full_name} (${row.user_nrp})`, 14, 28)
        doc.text(
            `Base: Rp ${moneyStr(row.base_tukin)} | Expected: ${row.expected_units} | Earned: ${Number(row.earned_credit ?? 0).toFixed(2)} | Ratio: ${(Number(row.attendance_ratio ?? 0) * 100).toFixed(2)}% | Final: Rp ${moneyStr(row.final_tukin)}`,
            14,
            33
        )

        const filterInfo = `Filter → onlyProblem=${onlyProblem ? "YA" : "TIDAK"}; showHoliday=${showHolidayIgnored ? "YA" : "TIDAK"}; search=${qText.trim() ? qText.trim() : "-"}; rows=${filteredDays.length}`
        //doc.text(filterInfo, 14, 38)

        const safeText = (s: unknown) =>
            String(s ?? "")
                // buang karakter kontrol & non printable
                .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
                // buang karakter yang sering bikin kacau di built-in font
                .replace(/[^\x20-\x7EÀ-ž]/g, " ")
                // rapikan spasi
                .replace(/\s+/g, " ")
                .trim()

// ganti simbol panah agar aman
        const safeFilterInfo = safeText(filterInfo.replace("→", "->"))
        //doc.text(safeFilterInfo, 14, 38)

        const body = filteredDays.map((d, idx) => {
            const reasons = buildReasons(d).join(" | ")
            const penalty = getPenaltyDisplay(d, estimatePenalty)?.text ?? "-"
            return [
                String(idx + 1),
                d.work_date ? formatTanggalID(d.work_date, tz) : "-",
                Number(d.expected_unit ?? 0).toFixed(2),
                Number(d.earned_credit ?? 0).toFixed(2),
                fmtIsoHm(d.check_in_at ?? null, tz),
                fmtIsoHm(d.check_out_at ?? null, tz),
                String(d.late_minutes ?? "-"),
                penalty,
                reasons || "-",
            ]
        })

        autoTable(doc, {
            startY: 42,
            head: [[
                "No",
                "Tanggal",
                "Expected",
                "Earned",
                "In",
                "Out",
                "Late",
                "Penalty",
                "Reason",
            ]],
            body,
            styles: { fontSize: 8 },
            headStyles: { fontSize: 8 },
            columnStyles: {
                0: { cellWidth: 10 },
                1: { cellWidth: 42 },
                2: { cellWidth: 20, halign: "right" },
                3: { cellWidth: 20, halign: "right" },
                4: { cellWidth: 14 },
                5: { cellWidth: 14 },
                6: { cellWidth: 14, halign: "right" },
                7: { cellWidth: 22 },
                8: { cellWidth: 110 },
            },
        })

        const pageW = doc.internal.pageSize.getWidth()
        const rightX = pageW - 70

        const today = new Date()
        const todayStr = new Intl.DateTimeFormat("id-ID", {
            dateStyle: "long",
            timeZone: tz,
        }).format(today)

        const lastY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY : 180
        const signY = Math.min(lastY + 10, 190)

        doc.setFontSize(10)
        doc.text(`Tanggal cetak: ${todayStr}`, 14, signY)
        doc.text("Mengetahui,", rightX, signY)
        doc.text("Kepala Satker", rightX, signY + 6)
        doc.text("(________________________)", rightX, signY + 28)

        const satkerCode = row.satker_code ?? "SATKER"
        const fname = `tukin_detail_${month}_${satkerCode}_${row.user_nrp}.pdf`.replace(/[^\w.-]+/g, "_")
        doc.save(fname)
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle>Detail Tukin Bulanan</CardTitle>
                    <div className="flex gap-2">
                        <Button variant="secondary" onClick={exportExcel} disabled={!row || filteredDays.length === 0}>
                            Export Excel
                        </Button>
                        <Button variant="secondary" onClick={exportPdf} disabled={!row || filteredDays.length === 0}>
                            Export PDF
                        </Button>
                        <Button variant="outline" onClick={() => nav(-1)}>Kembali</Button>
                    </div>
                </div>

                {row ? (
                    <div className="mt-2 space-y-3 text-sm text-muted-foreground">
                        <div className="font-medium text-foreground">
                            {row.user_full_name} ({row.user_nrp}) • {row.satker_code} - {row.satker_name}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <div className="rounded-md border px-2 py-1">
                                Bulan: <span className="text-foreground font-medium">{formatBulanID(month, tz)}</span>
                            </div>
                            <div className="rounded-md border px-2 py-1">
                                Base: <span className="text-foreground font-medium"><Money value={row.base_tukin} /></span>
                            </div>
                            <div className="rounded-md border px-2 py-1">
                                Expected: <span className="text-foreground font-medium">{row.expected_units}</span>
                            </div>
                            <div className="rounded-md border px-2 py-1">
                                Earned: <span className="text-foreground font-medium">{Number(row.earned_credit ?? 0).toFixed(2)}</span>
                            </div>
                            <div className="rounded-md border px-2 py-1">
                                Ratio: <span className="text-foreground font-medium"><Ratio value={row.attendance_ratio} /></span>
                            </div>
                            <div className="rounded-md border px-2 py-1">
                                Final: <span className="text-foreground font-medium"><Money value={row.final_tukin} /></span>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Badge variant={stats.missingCheckout > 0 ? "destructive" : "outline"}>
                                Missing Checkout: {stats.missingCheckout}
                            </Badge>
                            <Badge variant={stats.outGeofence > 0 ? "destructive" : "outline"}>
                                Out of Geofence: {stats.outGeofence}
                            </Badge>
                            <Badge variant="outline">
                                Late: {stats.lateDays} hari • {stats.lateTotalMinutes} menit
                            </Badge>
                            <Badge variant={stats.duty > 0 ? "secondary" : "outline"}>
                                Duty: {stats.duty}
                            </Badge>
                            <Badge variant="outline">
                                Holiday Ignored: {stats.holidayIgnored}
                            </Badge>
                            <Badge variant="outline">
                                Halfday: {stats.halfday}
                            </Badge>
                            <Badge variant="outline">
                                Workday OK: {stats.workdayOk}
                            </Badge>
                        </div>
                    </div>
                ) : null}
            </CardHeader>

            <CardContent className="space-y-4">
                {q.isLoading ? (
                    <div className="text-sm text-muted-foreground">Memuat...</div>
                ) : q.isError ? (
                    <div className="text-sm text-destructive">
                        {apiErrorMessage((q as any).error)}
                    </div>
                ) : !row ? (
                    <div className="text-sm text-muted-foreground">Data tidak ditemukan.</div>
                ) : (
                    <>
                        {/* FILTER BAR */}
                        <div className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-end md:justify-between">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div className="space-y-1">
                                    <Label>Cari</Label>
                                    <Input
                                        value={qText}
                                        onChange={(e) => setQText(e.target.value)}
                                        placeholder="Cari tanggal/note/jam..."
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-md border px-3 py-2 md:mt-6">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Bermasalah saja</div>
                                        <div className="text-xs text-muted-foreground">Late / Missing / Out / Duty</div>
                                    </div>
                                    <Switch checked={onlyProblem} onCheckedChange={setOnlyProblem} />
                                </div>

                                <div className="flex items-center justify-between rounded-md border px-3 py-2 md:mt-6">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Tampilkan holiday</div>
                                        <div className="text-xs text-muted-foreground">HOLIDAY_IGNORED</div>
                                    </div>
                                    <Switch checked={showHolidayIgnored} onCheckedChange={setShowHolidayIgnored} />
                                </div>

                                <div className="flex items-center justify-between rounded-md border px-3 py-2 md:mt-6">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Estimasi penalty</div>
                                        <div className="text-xs text-muted-foreground">Jika backend belum kirim</div>
                                    </div>
                                    <Switch checked={estimatePenalty} onCheckedChange={setEstimatePenalty} />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Legend:</span>
                                <span className="rounded px-2 py-1 bg-red-500/10 border">Missing / Out</span>
                                <span className="rounded px-2 py-1 bg-yellow-500/10 border">Late</span>
                                <span className="rounded px-2 py-1 bg-blue-500/10 border">Duty</span>
                                <span className="rounded px-2 py-1 border opacity-70">Holiday Ignored</span>
                            </div>
                        </div>

                        {/* TABLE */}
                        <div className="rounded-md border bg-background">
                            <div className="max-h-[75vh] overflow-auto">
                                <div className="min-w-[1240px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background">
                                            <TableRow>
                                                <TableHead className="w-[120px]">Tanggal</TableHead>
                                                <TableHead className="w-[90px] text-right">Expected</TableHead>
                                                <TableHead className="w-[90px] text-right">Earned</TableHead>
                                                <TableHead className="w-[170px]">Check In</TableHead>
                                                <TableHead className="w-[170px]">Check Out</TableHead>
                                                <TableHead className="w-[90px] text-right">Late (m)</TableHead>
                                                <TableHead className="w-[180px]">Penalty</TableHead>
                                                <TableHead className="min-w-[360px]">Reason</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {filteredDays.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                                                        Tidak ada baris yang cocok dengan filter.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredDays.map((d, idx) => {
                                                    const reasons = buildReasons(d)
                                                    const penalty = getPenaltyDisplay(d, estimatePenalty)
                                                    return (
                                                        <TableRow key={`${d.work_date ?? idx}-${idx}`} className={rowClass(d)}>
                                                            <TableCell className="whitespace-nowrap font-medium">
                                                                {d.work_date ? formatTanggalID(d.work_date, tz) : "-"}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {Number(d.expected_unit ?? 0).toFixed(2)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {Number(d.earned_credit ?? 0).toFixed(2)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap">
                                                                {fmtIsoHm(d.check_in_at ?? null, tz)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap">
                                                                {fmtIsoHm(d.check_out_at ?? null, tz)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {d.late_minutes ?? "-"}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap">
                                                                {penalty ? (
                                                                    <span className={penalty.muted ? "text-muted-foreground" : "text-foreground font-medium"}>
                                    {penalty.text}
                                  </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <DayNoteBadge d={d} />
                                                                    {reasons.length === 0 ? (
                                                                        <span className="text-muted-foreground">-</span>
                                                                    ) : (
                                                                        reasons.map((r, i) => (
                                                                            <Badge key={i} variant="outline">{r}</Badge>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>

                        {!estimatePenalty ? (
                            <div className="text-xs text-muted-foreground">
                                Catatan: kolom Penalty akan tampil akurat jika backend mengirim <code>penalty_pct</code>/<code>penalty_reason</code>.
                                Untuk sementara, Reason menunjukkan penyebab (audit trail) berdasarkan data absensi.
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">
                                Catatan: “Estimasi penalty” hanya perkiraan UI (untuk bantu audit cepat) sampai backend mengirim penalty sebenarnya.
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}




/*
import * as React from "react"
import dayjs from "dayjs"
import { useNavigate, useSearchParams } from "react-router-dom"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table"

import { apiErrorMessage } from "@/lib/api-error"
import { useTimezoneQuery } from "@/features/settings/hooks"
import { useTukinCalculations } from "@/features/tukin/hooks"
import type { TukinCalculationRow } from "@/features/tukin/types"

function Money({ value }: { value: number }) {
    const v = Number.isFinite(value) ? value : 0
    return <span>{new Intl.NumberFormat("id-ID").format(Math.round(v))}</span>
}

function Ratio({ value }: { value: number }) {
    const v = Number.isFinite(value) ? value : 0
    return <span>{(v * 100).toFixed(2)}%</span>
}

function fmtIsoYmdHm(isoUtc?: string | null, tz?: string) {
    if (!isoUtc) return "-"
    try {
        const d = new Date(isoUtc)
        const date = new Intl.DateTimeFormat("en-CA", {
            timeZone: tz ?? "Asia/Jakarta",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(d)
        const time = new Intl.DateTimeFormat("en-GB", {
            timeZone: tz ?? "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(d)
        return `${date} ${time}`
    } catch {
        // fallback: browser timezone
        return dayjs(isoUtc).format("YYYY-MM-DD HH:mm")
    }
}

function fmtIsoHm(isoUtc?: string | null, tz?: string) {
    if (!isoUtc) return "-"
    try {
        const d = new Date(isoUtc)
        const time = new Intl.DateTimeFormat("en-GB", {
            timeZone: tz ?? "Asia/Jakarta",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).format(d)
        return `${time}`
    } catch {
        // fallback: browser timezone
        return dayjs(isoUtc).format("HH:mm")
    }
}

function formatTanggalID(iso: string, tz: string) {
    return new Intl.DateTimeFormat("id-ID", {
        dateStyle: "long",
        timeZone: tz,
    }).format(new Date(iso))
}

function formatBulanID(isoMonth: string, tz: string) {
    const date = new Date(`${isoMonth}-01`);
    const formatted = new Intl.DateTimeFormat("id-ID", {
        month: "long",
        year: "numeric",
        timeZone: tz,
    }).format(date);

    // Memastikan huruf pertama kapital
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatJamID(iso: string, tz: string) {
    return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: tz,
    }).format(new Date(iso))
}

type DayRow = {
    work_date?: string
    expected_unit?: number
    earned_credit?: number
    check_in_at?: string | null
    check_out_at?: string | null
    late_minutes?: number | null
    note?: string | null

    // OPTIONAL (kalau backend sudah mulai kirim)
    penalty_pct?: number | null
    penalty_reason?: string | null
    // atau bentuk lain:
    // penalties?: { code: string; pct?: number; amount?: number; note?: string }[]
}

function noteStr(d: DayRow): string {
    return String(d.note ?? "").trim().toUpperCase()
}

function lateMinutes(d: DayRow): number {
    const v = Number(d.late_minutes ?? 0)
    return Number.isFinite(v) ? v : 0
}

function isDuty(d: DayRow) {
    const n = noteStr(d)
    // Duty schedule markers ONLY.
    // IMPORTANT: jangan treat "DINAS_LUAR" (attendance_leave) sebagai duty schedule.
    return (
        n.includes("DUTY_SCHEDULE") ||
        n.includes("JADWAL_DINAS") ||
        n === "DUTY" ||
        n === "DUTY-SCHEDULE" ||
        n === "DUTY SCHEDULE"
    )
}

function isHolidayIgnored(d: DayRow) {
    const n = noteStr(d)
    return n.includes("HOLIDAY_IGNORED") || (n.includes("HOLIDAY") && !n.includes("DUTY"))
}

function isHalfday(d: DayRow) {
    const n = noteStr(d)
    return n.includes("HALFDAY")
}

function isOutOfGeofence(d: DayRow) {
    const n = noteStr(d)
    return n.includes("GEOFENCE") || n.includes("OUT_OF_GEOFENCE") || n.includes("OUT_GEOFENCE")
}

function isMissingCheckout(d: DayRow) {
    // Duty schedule: checkout tidak wajib, jadi jangan pernah dianggap missing.
    if (isDuty(d)) return false
    if (d.check_in_at && !d.check_out_at) return true
    const n = noteStr(d)
    return n.includes("MISSING_CHECKOUT") || n.includes("NO_CHECKOUT")
}

function isProblemDay(d: DayRow) {
    return isMissingCheckout(d) || isOutOfGeofence(d) || lateMinutes(d) > 0 || isDuty(d)
}

function DayNoteBadge({ d }: { d: DayRow }) {
    const n = noteStr(d)

    if (isMissingCheckout(d)) return <Badge variant="destructive">MISSING_CHECKOUT</Badge>
    if (isOutOfGeofence(d)) return <Badge variant="destructive">OUT_OF_GEOFENCE</Badge>
    if (isDuty(d)) return <Badge variant="secondary">DUTY_SCHEDULE</Badge>
    if (lateMinutes(d) > 0) return <Badge variant="outline">LATE</Badge>
    if (isHolidayIgnored(d)) return <Badge variant="outline">HOLIDAY_IGNORED</Badge>
    if (isHalfday(d)) return <Badge variant="outline">HALFDAY</Badge>

    if (n) return <Badge variant="outline">{n}</Badge>
    return <Badge variant="outline">-</Badge>
}

function rowClass(d: DayRow): string {
    if (isMissingCheckout(d)) return "bg-red-500/10"
    if (isOutOfGeofence(d)) return "bg-red-500/10"
    if (isDuty(d)) return "bg-blue-500/10"
    if (lateMinutes(d) > 0) return "bg-yellow-500/10"
    if (isHolidayIgnored(d)) return "opacity-70"
    return ""
}

// =========================
// Reason builder (audit-friendly)
// =========================
function buildReasons(d: DayRow): string[] {
    const out: string[] = []

    // holiday ignored biasanya bukan penalti (kalau tidak ada duty)
    if (isHolidayIgnored(d)) out.push("Holiday (ignored)")
    if (isDuty(d)) out.push("Duty schedule")

    const lateM = lateMinutes(d)
    if (lateM > 0) out.push(`Late ${lateM}m`)

    if (isOutOfGeofence(d)) out.push("Out of geofence")
    if (isMissingCheckout(d)) out.push("Missing checkout")

    // extra note kalau ada note yang tidak kita kenal
    const n = noteStr(d)
    const known =
        isHolidayIgnored(d) || isDuty(d) || isHalfday(d) || lateM > 0 || isOutOfGeofence(d) || isMissingCheckout(d)
    if (!known && n) out.push(n)

    return out
}

// =========================
// Penalty display
// =========================
function fmtPct(p: number) {
    return `${p.toFixed(2)}%`
}

/!**
 * Jika backend sudah punya `penalty_pct` / `penalty_reason`, pakai itu.
 * Kalau belum ada: return null (atau estimasi jika enabled).
 *!/
function getPenaltyDisplay(d: DayRow, enableEstimate: boolean): { text: string; muted?: boolean } | null {
    const backendPct = typeof d.penalty_pct === "number" && Number.isFinite(d.penalty_pct) ? d.penalty_pct : null
    if (backendPct !== null) {
        const r = String(d.penalty_reason ?? "").trim()
        return { text: r ? `${fmtPct(backendPct)} • ${r}` : fmtPct(backendPct) }
    }

    if (!enableEstimate) return null

    // ===== Estimasi FE (OPTIONAL) =====
    // Karena policy belum dikirim ke FE, kita estimasi minimal:
    // - Missing checkout -> 25% (default v1 kamu)
    // - Out of geofence -> 0% (default v1 kamu)
    // - Late -> 0% per menit (default v1 kamu)
    //
    // Ini cuma supaya kolom "Penalty" tidak kosong, tapi kita tandai (estimasi).
    let pct = 0

    if (isMissingCheckout(d)) pct = Math.max(pct, 25)
    // kalau nanti kamu punya default policy lain, tinggal ubah di sini:
    // if (isOutOfGeofence(d)) pct = Math.max(pct, 10)
    // if (lateMinutes(d) > tolerance) pct += lateMinutes(d) * perMinute

    if (pct <= 0) return { text: "-", muted: true }
    return { text: `${fmtPct(pct)} (estimasi)`, muted: true }
}

export default function TukinCalculationDetailPage() {
    const nav = useNavigate()
    const [sp] = useSearchParams()

    const tzQ = useTimezoneQuery()
    const tz = tzQ.data?.timezone ?? "Asia/Jakarta"

    const month = sp.get("month") ?? ""
    const satkerId = sp.get("satkerId") ?? ""
    const userId = sp.get("userId") ?? ""

    const canQuery = !!month && !!satkerId && !!userId

    const q = useTukinCalculations({
        month,
        satkerId,
        userId,
        enabled: canQuery,
    })

    React.useEffect(() => {
        if (!canQuery) toast.error("Parameter tidak lengkap (month/satkerId/userId)")
    }, [canQuery])

    const row: TukinCalculationRow | null = (q.data && q.data.length > 0) ? q.data[0] : null
    const days: DayRow[] = ((row?.breakdown?.days as any[]) ?? []) as DayRow[]

    // =========================
    // INSIGHT CEPAT (COUNTER)
    // =========================
    const stats = React.useMemo(() => {
        let missingCheckout = 0
        let lateDays = 0
        let lateTotalMinutes = 0
        let outGeofence = 0
        let duty = 0
        let holidayIgnored = 0
        let halfday = 0
        let workdayOk = 0

        for (const d of days) {
            const miss = isMissingCheckout(d)
            const lateM = lateMinutes(d)
            const out = isOutOfGeofence(d)
            const du = isDuty(d)
            const hol = isHolidayIgnored(d)
            const half = isHalfday(d)

            if (miss) missingCheckout += 1
            if (lateM > 0) {
                lateDays += 1
                lateTotalMinutes += lateM
            }
            if (out) outGeofence += 1
            if (du) duty += 1
            if (hol) holidayIgnored += 1
            if (half) halfday += 1

            const hasWorkSignal = (Number(d.expected_unit ?? 0) > 0) || !!d.check_in_at
            const problem = miss || out || lateM > 0
            if (hasWorkSignal && !hol && !du && !problem) workdayOk += 1
        }

        return {
            missingCheckout,
            lateDays,
            lateTotalMinutes,
            outGeofence,
            duty,
            holidayIgnored,
            halfday,
            workdayOk,
            totalDays: days.length,
        }
    }, [days])

    // =========================
    // FILTER UI
    // =========================
    const [onlyProblem, setOnlyProblem] = React.useState(false)
    const [showHolidayIgnored, setShowHolidayIgnored] = React.useState(false)
    const [qText, setQText] = React.useState("")
    const [estimatePenalty, setEstimatePenalty] = React.useState(false)

    React.useEffect(() => {
        if (onlyProblem) setShowHolidayIgnored(false)
    }, [onlyProblem])

    const filteredDays = React.useMemo(() => {
        const t = qText.trim().toUpperCase()

        return days.filter((d) => {
            if (onlyProblem && !isProblemDay(d)) return false
            if (!showHolidayIgnored && isHolidayIgnored(d)) return false

            if (!t) return true
            const hay = `${d.work_date ?? ""} ${noteStr(d)} ${d.check_in_at ?? ""} ${d.check_out_at ?? ""}`.toUpperCase()
            return hay.includes(t)
        })
    }, [days, onlyProblem, showHolidayIgnored, qText])

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle>Detail Tukin Bulanan</CardTitle>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => nav(-1)}>Kembali</Button>
                    </div>
                </div>

                {row ? (
                    <div className="mt-2 space-y-3 text-sm text-muted-foreground">
                        <div className="font-medium text-foreground">
                            {row.user_full_name} ({row.user_nrp}) • {row.satker_code} - {row.satker_name}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <div className="rounded-md border px-2 py-1">Bulan: <span className="text-foreground font-medium">{formatBulanID(month, tz)}</span></div>
                            <div className="rounded-md border px-2 py-1">Base: <span className="text-foreground font-medium"><Money value={row.base_tukin} /></span></div>
                            <div className="rounded-md border px-2 py-1">Expected: <span className="text-foreground font-medium">{row.expected_units}</span></div>
                            <div className="rounded-md border px-2 py-1">Earned: <span className="text-foreground font-medium">{row.earned_credit.toFixed(2)}</span></div>
                            <div className="rounded-md border px-2 py-1">Ratio: <span className="text-foreground font-medium"><Ratio value={row.attendance_ratio} /></span></div>
                            <div className="rounded-md border px-2 py-1">Final: <span className="text-foreground font-medium"><Money value={row.final_tukin} /></span></div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            <Badge variant={stats.missingCheckout > 0 ? "destructive" : "outline"}>
                                Missing Checkout: {stats.missingCheckout}
                            </Badge>
                            <Badge variant={stats.outGeofence > 0 ? "destructive" : "outline"}>
                                Out of Geofence: {stats.outGeofence}
                            </Badge>
                            <Badge variant="outline">
                                Late: {stats.lateDays} hari • {stats.lateTotalMinutes} menit
                            </Badge>
                            <Badge variant={stats.duty > 0 ? "secondary" : "outline"}>
                                Duty: {stats.duty}
                            </Badge>
                            <Badge variant="outline">
                                Holiday Ignored: {stats.holidayIgnored}
                            </Badge>
                            <Badge variant="outline">
                                Halfday: {stats.halfday}
                            </Badge>
                            <Badge variant="outline">
                                Workday OK: {stats.workdayOk}
                            </Badge>
                        </div>
                    </div>
                ) : null}
            </CardHeader>

            <CardContent className="space-y-4">
                {q.isLoading ? (
                    <div className="text-sm text-muted-foreground">Memuat...</div>
                ) : q.isError ? (
                    <div className="text-sm text-destructive">
                        {apiErrorMessage((q as any).error)}
                    </div>
                ) : !row ? (
                    <div className="text-sm text-muted-foreground">Data tidak ditemukan.</div>
                ) : (
                    <>
                        {/!* FILTER BAR *!/}
                        <div className="flex flex-col gap-3 rounded-md border p-3 md:flex-row md:items-end md:justify-between">
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                                <div className="space-y-1">
                                    <Label>Cari</Label>
                                    <Input
                                        value={qText}
                                        onChange={(e) => setQText(e.target.value)}
                                        placeholder="Cari tanggal/note/jam..."
                                    />
                                </div>

                                <div className="flex items-center justify-between rounded-md border px-3 py-2 md:mt-6">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Bermasalah saja</div>
                                        <div className="text-xs text-muted-foreground">Late / Missing / Out / Duty</div>
                                    </div>
                                    <Switch checked={onlyProblem} onCheckedChange={setOnlyProblem} />
                                </div>

                                <div className="flex items-center justify-between rounded-md border px-3 py-2 md:mt-6">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Tampilkan holiday</div>
                                        <div className="text-xs text-muted-foreground">HOLIDAY_IGNORED</div>
                                    </div>
                                    <Switch checked={showHolidayIgnored} onCheckedChange={setShowHolidayIgnored} />
                                </div>

                                <div className="flex items-center justify-between rounded-md border px-3 py-2 md:mt-6">
                                    <div className="space-y-0.5">
                                        <div className="text-sm font-medium">Estimasi penalty</div>
                                        <div className="text-xs text-muted-foreground">Jika backend belum kirim</div>
                                    </div>
                                    <Switch checked={estimatePenalty} onCheckedChange={setEstimatePenalty} />
                                </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                <span className="font-medium text-foreground">Legend:</span>
                                <span className="rounded px-2 py-1 bg-red-500/10 border">Missing / Out</span>
                                <span className="rounded px-2 py-1 bg-yellow-500/10 border">Late</span>
                                <span className="rounded px-2 py-1 bg-blue-500/10 border">Duty</span>
                                <span className="rounded px-2 py-1 border opacity-70">Holiday Ignored</span>
                            </div>
                        </div>

                        {/!* TABLE *!/}
                        <div className="rounded-md border bg-background">
                            <div className="max-h-[75vh] overflow-auto">
                                {/!* tambah lebar karena kolom Reason/Penalty *!/}
                                <div className="min-w-[1240px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background">
                                            <TableRow>
                                                <TableHead className="w-[120px]">Tanggal</TableHead>
                                                <TableHead className="w-[90px] text-right">Expected</TableHead>
                                                <TableHead className="w-[90px] text-right">Earned</TableHead>
                                                <TableHead className="w-[170px]">Check In</TableHead>
                                                <TableHead className="w-[170px]">Check Out</TableHead>
                                                <TableHead className="w-[90px] text-right">Late (m)</TableHead>
                                                <TableHead className="w-[180px]">Penalty</TableHead>
                                                <TableHead className="min-w-[360px]">Reason</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {filteredDays.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                                                        Tidak ada baris yang cocok dengan filter.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredDays.map((d, idx) => {
                                                    const reasons = buildReasons(d)
                                                    const penalty = getPenaltyDisplay(d, estimatePenalty)
                                                    return (
                                                        <TableRow key={`${d.work_date ?? idx}-${idx}`} className={rowClass(d)}>
                                                            <TableCell className="whitespace-nowrap font-medium">
                                                                {formatTanggalID(d.work_date ?? "", tz) ?? "-"}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {Number(d.expected_unit ?? 0).toFixed(2)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {Number(d.earned_credit ?? 0).toFixed(2)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap">
                                                                {/!*{fmtIsoYmdHm(d.check_in_at ?? null, tz)}*!/}
                                                                {fmtIsoHm(d.check_in_at ?? null, tz)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap">
                                                                {/!*{fmtIsoYmdHm(d.check_out_at ?? null, tz)}*!/}
                                                                {fmtIsoHm(d.check_out_at ?? null, tz)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {d.late_minutes ?? "-"}
                                                            </TableCell>

                                                            {/!* Penalty *!/}
                                                            <TableCell className="whitespace-nowrap">
                                                                {penalty ? (
                                                                    <span className={penalty.muted ? "text-muted-foreground" : "text-foreground font-medium"}>
                                    {penalty.text}
                                  </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>

                                                            {/!* Reason *!/}
                                                            <TableCell className="whitespace-nowrap">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <DayNoteBadge d={d} />
                                                                    {reasons.length === 0 ? (
                                                                        <span className="text-muted-foreground">-</span>
                                                                    ) : (
                                                                        reasons.map((r, i) => (
                                                                            <Badge key={i} variant="outline">{r}</Badge>
                                                                        ))
                                                                    )}
                                                                </div>
                                                            </TableCell>
                                                        </TableRow>
                                                    )
                                                })
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>

                        {/!* Catatan kecil biar tidak menyesatkan *!/}
                        {!estimatePenalty ? (
                            <div className="text-xs text-muted-foreground">
                                Catatan: kolom Penalty akan tampil akurat jika backend mengirim <code>penalty_pct</code>/<code>penalty_reason</code>.
                                Untuk sementara, Reason menunjukkan penyebab (audit trail) berdasarkan data absensi.
                            </div>
                        ) : (
                            <div className="text-xs text-muted-foreground">
                                Catatan: “Estimasi penalty” hanya perkiraan UI (untuk bantu audit cepat) sampai backend mengirim penalty sebenarnya.
                            </div>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    )
}


*/
