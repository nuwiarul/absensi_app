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
    return n.includes("DUTY") || n.includes("DINAS")
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

/**
 * Jika backend sudah punya `penalty_pct` / `penalty_reason`, pakai itu.
 * Kalau belum ada: return null (atau estimasi jika enabled).
 */
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
                            <div className="rounded-md border px-2 py-1">Bulan: <span className="text-foreground font-medium">{month}</span></div>
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
                                {/* tambah lebar karena kolom Reason/Penalty */}
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
                                                                {d.work_date ?? "-"}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {Number(d.expected_unit ?? 0).toFixed(2)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {Number(d.earned_credit ?? 0).toFixed(2)}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap">
                                                                {d.check_in_at ? dayjs(d.check_in_at).format("YYYY-MM-DD HH:mm") : "-"}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap">
                                                                {d.check_out_at ? dayjs(d.check_out_at).format("YYYY-MM-DD HH:mm") : "-"}
                                                            </TableCell>

                                                            <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                                {d.late_minutes ?? "-"}
                                                            </TableCell>

                                                            {/* Penalty */}
                                                            <TableCell className="whitespace-nowrap">
                                                                {penalty ? (
                                                                    <span className={penalty.muted ? "text-muted-foreground" : "text-foreground font-medium"}>
                                    {penalty.text}
                                  </span>
                                                                ) : (
                                                                    <span className="text-muted-foreground">-</span>
                                                                )}
                                                            </TableCell>

                                                            {/* Reason */}
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

                        {/* Catatan kecil biar tidak menyesatkan */}
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
