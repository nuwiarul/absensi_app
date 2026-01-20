import * as React from "react"
import dayjs from "dayjs"
import { toast } from "sonner"
import { useNavigate } from "react-router-dom"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

import { apiErrorMessage } from "@/lib/api-error"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { useUsers } from "@/features/users/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useTimezoneQuery } from "@/features/settings/hooks"
import { useGenerateTukin, useTukinCalculations } from "@/features/tukin/hooks"
import type { TukinCalculationRow } from "@/features/tukin/types"

import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import * as XLSX from "xlsx"

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

function UserSelect({
                        value,
                        onChange,
                        users,
                        disabled,
                    }: {
    value?: string
    onChange: (v: string) => void
    users: { id: string; full_name: string; nrp: string }[]
    disabled?: boolean
}) {
    return (
        <Select
            value={value && value.length > 0 ? value : undefined}
            onValueChange={onChange}
            disabled={disabled}
        >
            <SelectTrigger>
                <SelectValue placeholder={disabled ? "Pilih satker dulu" : "Semua user"} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="ALL">Semua user</SelectItem>
                {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                        {u.full_name} • {u.nrp}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

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

function monthLabelFromYYYYMM(yyyyMm: string, tz: string) {
    try {
        const date = new Date(`${yyyyMm}-01`)
        const formatted = new Intl.DateTimeFormat("id-ID", {
            month: "long",
            year: "numeric",
            timeZone: tz,
        }).format(date)
        return formatted.charAt(0).toUpperCase() + formatted.slice(1)
    } catch {
        return yyyyMm
    }
}

export default function TukinCalculationsPage() {
    const session = getSession()
    const role = session?.role ?? "SUPERADMIN"
    const isSuper = role === "SUPERADMIN"

    const tzQ = useTimezoneQuery()
    const tz = tzQ.data?.timezone ?? "Asia/Jakarta"

    const [month, setMonth] = React.useState(() => dayjs().format("YYYY-MM"))
    const [satkerFilter, setSatkerFilter] = React.useState<string>(
        isSuper ? "ALL" : session?.satkerId ?? ""
    )
    const [userFilter, setUserFilter] = React.useState<string>("ALL")

    const satkersQ = useSatkers()
    const satkers = satkersQ.data ?? []

    const nav = useNavigate()

    // User dropdown only loads once satker selected (superadmin)
    const effectiveSatkerId = isSuper
        ? satkerFilter !== "ALL"
            ? satkerFilter
            : undefined
        : session?.satkerId

    const usersEnabled = !!effectiveSatkerId
    const usersQ = useUsers(effectiveSatkerId, usersEnabled)
    const users = usersQ.data ?? []

    // Reset userFilter when satker changes
    React.useEffect(() => {
        setUserFilter("ALL")
    }, [effectiveSatkerId])

    const canQuery = !!month && (!!effectiveSatkerId || !isSuper)
    const effectiveUserId = userFilter && userFilter !== "ALL" ? userFilter : undefined

    const calQ = useTukinCalculations({
        month,
        satkerId: effectiveSatkerId,
        userId: effectiveUserId,
        enabled: canQuery,
    })

    const genMut = useGenerateTukin()
    const busy = genMut.isPending || calQ.isFetching

    const generate = async (force: boolean) => {
        try {
            if (!canQuery) {
                if (isSuper) return toast.error("Pilih satker dulu")
                return toast.error("Bulan tidak valid")
            }
            await genMut.mutateAsync({
                month,
                satkerId: effectiveSatkerId,
                userId: effectiveUserId,
                force,
            })
            toast.success(force ? "Generate (force) berhasil" : "Generate berhasil")
        } catch (e: unknown) {
            toast.error(apiErrorMessage(e))
        }
    }

    const rows: TukinCalculationRow[] = calQ.data ?? []

    const selectedSatker = React.useMemo(() => {
        if (!effectiveSatkerId) return null
        return satkers.find((s: any) => s.id === effectiveSatkerId) ?? null
    }, [satkers, effectiveSatkerId])

    const selectedUser = React.useMemo(() => {
        if (!effectiveUserId) return null
        return users.find((u: any) => u.id === effectiveUserId) ?? null
    }, [users, effectiveUserId])

    const monthLabel = React.useMemo(() => monthLabelFromYYYYMM(month, tz), [month, tz])

    const exportExcel = () => {
        if (!rows || rows.length === 0) {
            toast.error("Tidak ada data")
            return
        }

        const totalFinal = rows.reduce((acc, r) => acc + (Number(r.final_tukin ?? 0) || 0), 0)
        const totalExpected = rows.reduce((acc, r) => acc + (Number(r.expected_units ?? 0) || 0), 0)
        const totalEarned = rows.reduce((acc, r) => acc + (Number(r.earned_credit ?? 0) || 0), 0)
        const avgRatio =
            rows.length > 0
                ? rows.reduce((acc, r) => acc + (Number(r.attendance_ratio ?? 0) || 0), 0) / rows.length
                : 0

        const summary = [
            {
                Periode: monthLabel,
                Satker: selectedSatker
                    ? `${selectedSatker.code} - ${selectedSatker.name}`
                    : effectiveSatkerId
                        ? effectiveSatkerId
                        : "ALL",
                User: selectedUser
                    ? `${selectedUser.full_name} (${selectedUser.nrp})`
                    : "ALL",
                "Jumlah Personel": rows.length,
                "Total Expected": totalExpected,
                "Total Earned": Number(totalEarned.toFixed(2)),
                "Rata-rata Ratio (%)": Number((avgRatio * 100).toFixed(2)),
                "Total Tukin Final": totalFinal,
            },
        ]

        const data = rows.map((r, idx) => ({
            No: idx + 1,
            Bulan: r.month ?? month,
            Satker: r.satker_code
                ? `${r.satker_code}${r.satker_name ? " - " + r.satker_name : ""}`
                : selectedSatker
                    ? `${selectedSatker.code} - ${selectedSatker.name}`
                    : "",
            Nama: r.user_full_name,
            NRP: r.user_nrp,
            Pangkat: r.rank_code
                ? `${r.rank_code}${r.rank_name ? " - " + r.rank_name : ""}`
                : "-",
            "Base Tukin": r.base_tukin,
            "Expected Unit": r.expected_units,
            "Earned Credit": Number(r.earned_credit ?? 0),
            "Attendance Ratio (%)": Number((r.attendance_ratio ?? 0) * 100),
            "Final Tukin": r.final_tukin,
            "Updated At": r.updated_at ?? "",
        }))

        const wsSummary = XLSX.utils.json_to_sheet(summary)
        const wsData = XLSX.utils.json_to_sheet(data)

        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, wsSummary, "Summary")
        XLSX.utils.book_append_sheet(wb, wsData, "Tukin")

        const satkerCode = selectedSatker?.code ?? "ALL"
        const userNrp = selectedUser?.nrp ?? "ALL"
        const fname = `tukin_${month}_${satkerCode}_${userNrp}.xlsx`.replace(/[^\w.-]+/g, "_")

        XLSX.writeFile(wb, fname)
    }

    const exportPdf = () => {
        if (!rows || rows.length === 0) {
            toast.error("Tidak ada data")
            return
        }

        const doc = new jsPDF({ orientation: "landscape" })

        // Header
        doc.setFontSize(12)
        doc.text("Laporan Tukin Bulanan", 14, 12)

        doc.setFontSize(10)
        doc.text(`Periode: ${monthLabel}`, 14, 18)

        if (selectedSatker) {
            doc.text(`Satker: ${selectedSatker.code} - ${selectedSatker.name}`, 14, 23)
        } else if (effectiveSatkerId) {
            doc.text(`Satker: ${effectiveSatkerId}`, 14, 23)
        }

        if (selectedUser) {
            doc.text(`User: ${selectedUser.full_name} (${selectedUser.nrp})`, 14, 28)
        }

        const totalFinal = rows.reduce((acc, r) => acc + (Number(r.final_tukin ?? 0) || 0), 0)
        doc.text(`Jumlah Personel: ${rows.length} | Total Tukin Final: Rp ${moneyStr(totalFinal)}`, 14, 33)

        const body = rows.map((r, idx) => [
            String(idx + 1),
            r.user_full_name,
            r.user_nrp,
            r.rank_code ? `${r.rank_code}${r.rank_name ? " - " + r.rank_name : ""}` : "-",
            `Rp ${moneyStr(r.base_tukin)}`,
            String(r.expected_units ?? 0),
            Number(r.earned_credit ?? 0).toFixed(2),
            `${((Number(r.attendance_ratio ?? 0)) * 100).toFixed(2)}%`,
            `Rp ${moneyStr(r.final_tukin)}`,
            r.updated_at ? fmtIsoYmdHm(r.updated_at, tz) : "-",
        ])

        autoTable(doc, {
            startY: 38,
            head: [[
                "No",
                "Nama",
                "NRP",
                "Pangkat",
                "Base",
                "Expected",
                "Earned",
                "Ratio",
                "Final",
                "Updated",
            ]],
            body,
            styles: { fontSize: 8 },
            headStyles: { fontSize: 8 },
        })

        // Footer tanda tangan
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

        const satkerCode = selectedSatker?.code ?? "ALL"
        const userNrp = selectedUser?.nrp ?? "ALL"
        const fname = `tukin_${month}_${satkerCode}_${userNrp}.pdf`.replace(/[^\w.-]+/g, "_")
        doc.save(fname)
    }

    // (Optional) modal detail breakdown (tetap dibiarkan sesuai file kamu)
    const [detailOpen, setDetailOpen] = React.useState(false)
    const [detailRow, setDetailRow] = React.useState<TukinCalculationRow | null>(null)
    const days: any[] = (detailRow?.breakdown?.days as any[]) ?? []

    return (
        <Card>
            <CardHeader>
                <CardTitle>Laporan Tukin (Cache Bulanan)</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="space-y-1">
                        <Label>Bulan</Label>
                        <Input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            disabled={busy}
                        />
                    </div>

                    {isSuper ? (
                        <div className="space-y-1">
                            <Label>Satker</Label>
                            <SatkerSelect
                                value={satkerFilter}
                                onChange={setSatkerFilter}
                                items={satkers.filter((s) => s.is_active)}
                                allowAll
                                allLabel="Pilih satker..."
                                allValue="ALL"
                                placeholder={satkersQ.isLoading ? "Memuat..." : "Pilih satker"}
                                disabled={satkersQ.isLoading}
                            />
                            {satkerFilter === "ALL" ? (
                                <p className="text-xs text-muted-foreground">
                                    Pilih satker terlebih dahulu untuk melihat laporan.
                                </p>
                            ) : null}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <Label>Satker</Label>
                            <Input
                                value={`${session?.satkerCode ?? ""} - ${session?.satkerName ?? ""}`}
                                readOnly
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label>User</Label>
                        <UserSelect
                            value={userFilter}
                            onChange={setUserFilter}
                            users={users.map((u) => ({
                                id: u.id,
                                full_name: u.full_name,
                                nrp: u.nrp,
                            }))}
                            disabled={!usersEnabled || usersQ.isLoading || busy}
                        />
                    </div>

                    <div className="flex items-end flex-wrap gap-2">
                        <Button onClick={() => generate(false)} disabled={busy || !canQuery}>
                            Generate
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => generate(true)}
                            disabled={busy || !canQuery}
                        >
                            Force
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={exportExcel}
                            disabled={busy || rows.length === 0}
                        >
                            Export Excel
                        </Button>

                        <Button
                            variant="secondary"
                            onClick={exportPdf}
                            disabled={busy || rows.length === 0}
                        >
                            Export PDF
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>NRP</TableHead>
                                <TableHead>Pangkat</TableHead>
                                <TableHead className="text-right">Base</TableHead>
                                <TableHead className="text-right">Expected</TableHead>
                                <TableHead className="text-right">Earned</TableHead>
                                <TableHead className="text-right">Ratio</TableHead>
                                <TableHead className="text-right">Final</TableHead>
                                <TableHead className="text-right">Detail</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {calQ.isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                                        Memuat...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                                        Tidak ada data
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((r) => (
                                    <TableRow key={r.user_id}>
                                        <TableCell>{r.user_full_name}</TableCell>
                                        <TableCell>{r.user_nrp}</TableCell>
                                        <TableCell>
                                            {r.rank_code ? `${r.rank_code} - ${r.rank_name ?? ""}` : "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Money value={r.base_tukin} />
                                        </TableCell>
                                        <TableCell className="text-right">{r.expected_units}</TableCell>
                                        <TableCell className="text-right">{r.earned_credit.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Ratio value={r.attendance_ratio} />
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            <Money value={r.final_tukin} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => {
                                                    const satkerId = effectiveSatkerId ?? ""
                                                    nav(
                                                        `/tukin/calculations/detail?month=${encodeURIComponent(
                                                            month
                                                        )}&satkerId=${encodeURIComponent(
                                                            satkerId
                                                        )}&userId=${encodeURIComponent(r.user_id)}`
                                                    )
                                                }}
                                            >
                                                Detail
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* MODAL DETAIL (opsional, tidak dipakai sekarang, dibiarkan sesuai file asli) */}
                <Dialog
                    open={detailOpen}
                    onOpenChange={(v) => {
                        setDetailOpen(v)
                        if (!v) setDetailRow(null)
                    }}
                >
                    <DialogContent className="max-w-5xl pr-16">
                        <DialogHeader className="space-y-2">
                            <DialogTitle>
                                Breakdown Harian — {detailRow?.user_full_name ?? "-"} ({detailRow?.user_nrp ?? "-"})
                            </DialogTitle>
                        </DialogHeader>

                        <div className="rounded-md border bg-background">
                            <div className="max-h-[70vh] overflow-auto">
                                <div className="min-w-[980px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background">
                                            <TableRow>
                                                <TableHead className="w-[120px]">Tanggal</TableHead>
                                                <TableHead className="w-[90px] text-right">Expected</TableHead>
                                                <TableHead className="w-[90px] text-right">Earned</TableHead>
                                                <TableHead className="w-[170px]">Check In</TableHead>
                                                <TableHead className="w-[170px]">Check Out</TableHead>
                                                <TableHead className="w-[90px] text-right">Late (m)</TableHead>
                                                <TableHead className="min-w-[260px]">Note</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {days.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                                                        Breakdown belum tersedia pada cache ini.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                days.map((d, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="whitespace-nowrap font-medium">
                                                            {d.work_date}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                            {Number(d.expected_unit ?? 0).toFixed(2)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                            {Number(d.earned_credit ?? 0).toFixed(2)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap">
                                                            {fmtIsoYmdHm(d.check_in_at ?? null, tz)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap">
                                                            {fmtIsoYmdHm(d.check_out_at ?? null, tz)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                            {d.late_minutes ?? "-"}
                                                        </TableCell>

                                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                            {d.note ?? ""}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}



/*
import * as React from "react"
import dayjs from "dayjs"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"

import { apiErrorMessage } from "@/lib/api-error"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { useUsers } from "@/features/users/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useTimezoneQuery } from "@/features/settings/hooks"
import { useGenerateTukin, useTukinCalculations } from "@/features/tukin/hooks"
import type { TukinCalculationRow } from "@/features/tukin/types"
import {useNavigate} from "react-router-dom";

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

function UserSelect({
                        value,
                        onChange,
                        users,
                        disabled,
                    }: {
    value?: string
    onChange: (v: string) => void
    users: { id: string; full_name: string; nrp: string }[]
    disabled?: boolean
}) {
    return (
        <Select
            value={value && value.length > 0 ? value : undefined}
            onValueChange={onChange}
            disabled={disabled}
        >
            <SelectTrigger>
                <SelectValue placeholder={disabled ? "Pilih satker dulu" : "Semua user"} />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="ALL">Semua user</SelectItem>
                {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                        {u.full_name} • {u.nrp}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )
}

function Money({ value }: { value: number }) {
    const v = Number.isFinite(value) ? value : 0
    return <span>{new Intl.NumberFormat("id-ID").format(Math.round(v))}</span>
}

function Ratio({ value }: { value: number }) {
    const v = Number.isFinite(value) ? value : 0
    return <span>{(v * 100).toFixed(2)}%</span>
}


export default function TukinCalculationsPage() {
    const session = getSession()
    const role = session?.role ?? "SUPERADMIN"
    const isSuper = role === "SUPERADMIN"

    const tzQ = useTimezoneQuery()
    const tz = tzQ.data?.timezone ?? "Asia/Jakarta"

    const [month, setMonth] = React.useState(() => dayjs().format("YYYY-MM"))
    const [satkerFilter, setSatkerFilter] = React.useState<string>(
        isSuper ? "ALL" : session?.satkerId ?? ""
    )
    const [userFilter, setUserFilter] = React.useState<string>("ALL")

    const satkersQ = useSatkers()
    const satkers = satkersQ.data ?? []

    const nav = useNavigate()

    // User dropdown only loads once satker selected (superadmin)
    const effectiveSatkerId = isSuper
        ? satkerFilter !== "ALL"
            ? satkerFilter
            : undefined
        : session?.satkerId

    const usersEnabled = !!effectiveSatkerId
    const usersQ = useUsers(effectiveSatkerId, usersEnabled)
    const users = usersQ.data ?? []

    // Reset userFilter when satker changes
    React.useEffect(() => {
        setUserFilter("ALL")
    }, [effectiveSatkerId])

    const canQuery = !!month && (!!effectiveSatkerId || !isSuper)
    const effectiveUserId =
        userFilter && userFilter !== "ALL" ? userFilter : undefined

    const calQ = useTukinCalculations({
        month,
        satkerId: effectiveSatkerId,
        userId: effectiveUserId,
        enabled: canQuery,
    })

    const genMut = useGenerateTukin()
    const busy = genMut.isPending || calQ.isFetching

    const generate = async (force: boolean) => {
        try {
            if (!canQuery) {
                if (isSuper) return toast.error("Pilih satker dulu")
                return toast.error("Bulan tidak valid")
            }
            await genMut.mutateAsync({
                month,
                satkerId: effectiveSatkerId,
                userId: effectiveUserId,
                force,
            })
        } catch (e: unknown) {
            toast.error(apiErrorMessage(e))
        }
    }

    const rows: TukinCalculationRow[] = calQ.data ?? []

    const [detailOpen, setDetailOpen] = React.useState(false)
    const [detailRow, setDetailRow] = React.useState<TukinCalculationRow | null>(
        null
    )

    const openDetail = (r: TukinCalculationRow) => {
        setDetailRow(r)
        setDetailOpen(true)
    }

    const days: any[] = (detailRow?.breakdown?.days as any[]) ?? []

    return (
        <Card>
            <CardHeader>
                <CardTitle>Laporan Tukin (Cache Bulanan)</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="space-y-1">
                        <Label>Bulan</Label>
                        <Input
                            type="month"
                            value={month}
                            onChange={(e) => setMonth(e.target.value)}
                            disabled={busy}
                        />
                    </div>

                    {isSuper ? (
                        <div className="space-y-1">
                            <Label>Satker</Label>
                            <SatkerSelect
                                value={satkerFilter}
                                onChange={setSatkerFilter}
                                items={satkers.filter((s) => s.is_active)}
                                allowAll
                                allLabel="Pilih satker..."
                                allValue="ALL"
                                placeholder={satkersQ.isLoading ? "Memuat..." : "Pilih satker"}
                                disabled={satkersQ.isLoading}
                            />
                            {satkerFilter === "ALL" ? (
                                <p className="text-xs text-muted-foreground">
                                    Pilih satker terlebih dahulu untuk melihat laporan.
                                </p>
                            ) : null}
                        </div>
                    ) : (
                        <div className="space-y-1">
                            <Label>Satker</Label>
                            <Input
                                value={`${session?.satkerCode ?? ""} - ${
                                    session?.satkerName ?? ""
                                }`}
                                readOnly
                            />
                        </div>
                    )}

                    <div className="space-y-1">
                        <Label>User</Label>
                        <UserSelect
                            value={userFilter}
                            onChange={setUserFilter}
                            users={users.map((u) => ({
                                id: u.id,
                                full_name: u.full_name,
                                nrp: u.nrp,
                            }))}
                            disabled={!usersEnabled || usersQ.isLoading || busy}
                        />
                    </div>

                    <div className="flex items-end gap-2">
                        <Button onClick={() => generate(false)} disabled={busy || !canQuery}>
                            Generate
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => generate(true)}
                            disabled={busy || !canQuery}
                        >
                            Force
                        </Button>
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>User</TableHead>
                                <TableHead>NRP</TableHead>
                                <TableHead>Pangkat</TableHead>
                                <TableHead className="text-right">Base</TableHead>
                                <TableHead className="text-right">Expected</TableHead>
                                <TableHead className="text-right">Earned</TableHead>
                                <TableHead className="text-right">Ratio</TableHead>
                                <TableHead className="text-right">Final</TableHead>
                                <TableHead className="text-right">Detail</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {calQ.isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                                        Memuat...
                                    </TableCell>
                                </TableRow>
                            ) : rows.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="py-6 text-center text-muted-foreground">
                                        Tidak ada data
                                    </TableCell>
                                </TableRow>
                            ) : (
                                rows.map((r) => (
                                    <TableRow key={r.user_id}>
                                        <TableCell>{r.user_full_name}</TableCell>
                                        <TableCell>{r.user_nrp}</TableCell>
                                        <TableCell>
                                            {r.rank_code ? `${r.rank_code} - ${r.rank_name ?? ""}` : "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Money value={r.base_tukin} />
                                        </TableCell>
                                        <TableCell className="text-right">{r.expected_units}</TableCell>
                                        <TableCell className="text-right">{r.earned_credit.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Ratio value={r.attendance_ratio} />
                                        </TableCell>
                                        <TableCell className="text-right font-medium">
                                            <Money value={r.final_tukin} />
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => {
                                                const satkerId = effectiveSatkerId ?? ""
                                                nav(`/tukin/calculations/detail?month=${encodeURIComponent(month)}&satkerId=${encodeURIComponent(satkerId)}&userId=${encodeURIComponent(r.user_id)}`)
                                            }}>
                                                Detail
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/!* MODAL DETAIL *!/}
                <Dialog
                    open={detailOpen}
                    onOpenChange={(v) => {
                        setDetailOpen(v)
                        if (!v) setDetailRow(null)
                    }}
                >
                    <DialogContent className="max-w-5xl pr-16">
                        <DialogHeader className="space-y-2">
                            <DialogTitle>
                                Breakdown Harian — {detailRow?.user_full_name ?? "-"} ({detailRow?.user_nrp ?? "-"})
                            </DialogTitle>

                            {/!* ringkasan: chip + dibatasi lebar supaya tidak nyebar *!/}
                            <div className="max-w-4xl">
                                <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                                    <div className="rounded-md border px-2 py-1">
                                        Base:{" "}
                                        <span className="text-foreground font-medium">
                      <Money value={detailRow?.base_tukin ?? 0} />
                    </span>
                                    </div>

                                    <div className="rounded-md border px-2 py-1">
                                        Expected:{" "}
                                        <span className="text-foreground font-medium">
                      {detailRow?.expected_units ?? 0}
                    </span>
                                    </div>

                                    <div className="rounded-md border px-2 py-1">
                                        Earned:{" "}
                                        <span className="text-foreground font-medium">
                      {(detailRow?.earned_credit ?? 0).toFixed(2)}
                    </span>
                                    </div>

                                    <div className="rounded-md border px-2 py-1">
                                        Ratio:{" "}
                                        <span className="text-foreground font-medium">
                      <Ratio value={detailRow?.attendance_ratio ?? 0} />
                    </span>
                                    </div>

                                    <div className="rounded-md border px-2 py-1">
                                        Final:{" "}
                                        <span className="text-foreground font-medium">
                      <Money value={detailRow?.final_tukin ?? 0} />
                    </span>
                                    </div>
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="rounded-md border bg-background">
                            <div className="max-h-[70vh] overflow-auto">
                                <div className="min-w-[980px]">
                                    <Table>
                                        <TableHeader className="sticky top-0 bg-background">
                                            <TableRow>
                                                <TableHead className="w-[120px]">Tanggal</TableHead>
                                                <TableHead className="w-[90px] text-right">Expected</TableHead>
                                                <TableHead className="w-[90px] text-right">Earned</TableHead>
                                                <TableHead className="w-[170px]">Check In</TableHead>
                                                <TableHead className="w-[170px]">Check Out</TableHead>
                                                <TableHead className="w-[90px] text-right">Late (m)</TableHead>
                                                <TableHead className="min-w-[260px]">Note</TableHead>
                                            </TableRow>
                                        </TableHeader>

                                        <TableBody>
                                            {days.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                                                        Breakdown belum tersedia pada cache ini.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                days.map((d, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell className="whitespace-nowrap font-medium">
                                                            {d.work_date}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                            {Number(d.expected_unit ?? 0).toFixed(2)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                            {Number(d.earned_credit ?? 0).toFixed(2)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap">
                                                            {fmtIsoYmdHm(d.check_in_at ?? null, tz)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap">
                                                            {fmtIsoYmdHm(d.check_out_at ?? null, tz)}
                                                        </TableCell>

                                                        <TableCell className="whitespace-nowrap text-right tabular-nums">
                                                            {d.late_minutes ?? "-"}
                                                        </TableCell>

                                                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                            {d.note ?? ""}
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}


*/
