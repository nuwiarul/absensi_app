import * as React from "react"
import dayjs from "dayjs"
import {toast} from "sonner"

import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card"
import {Button} from "@/components/ui/button"
import {Input} from "@/components/ui/input"
import {Label} from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import {apiErrorMessage} from "@/lib/api-error"
import {getSession} from "@/lib/auth"
import {useSatkers} from "@/features/satkers/hooks"
import {SatkerSelect} from "@/features/users/SatkerSelect"
import {
    useCreateTukinPolicy,
    useLeaveRules,
    useSaveLeaveRules,
    useTukinPolicies,
    useUpdateTukinPolicy,
} from "@/features/tukin/hooks"
import type {CreateTukinPolicyReq, LeaveRule, PolicyScope, TukinPolicy} from "@/features/tukin/types"
import type {LeaveType} from "@/features/leave-requests/types"
import {ConfirmDialog} from "@/components/ConfirmDialog"
import {useDeleteTukinPolicy} from "@/features/tukin/hooks"


const LEAVE_TYPES: LeaveType[] = ["CUTI", "IJIN", "SAKIT", "DINAS_LUAR"]

function scopeLabel(s: PolicyScope) {
    return s === "GLOBAL" ? "Global" : "Satker"
}

function num(v: string) {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
}

function PolicyForm({
                        policy,
                        disabled,
                        onSave,
                        saving,
                    }: {
    policy: TukinPolicy
    disabled?: boolean
    saving?: boolean
    onSave: (patch: {
        effective_from: string
        effective_to?: string | null
        missing_checkout_penalty_pct: number
        late_tolerance_minutes: number
        late_penalty_per_minute_pct: number
        max_daily_penalty_pct: number
        out_of_geofence_penalty_pct: number
    }) => void
}) {
    const [effectiveFrom, setEffectiveFrom] = React.useState(policy.effective_from)
    const [effectiveTo, setEffectiveTo] = React.useState<string>(policy.effective_to ?? "")

    const [missingCheckout, setMissingCheckout] = React.useState(String(policy.missing_checkout_penalty_pct))
    const [lateTolerance, setLateTolerance] = React.useState(String(policy.late_tolerance_minutes))
    const [latePenalty, setLatePenalty] = React.useState(String(policy.late_penalty_per_minute_pct))
    const [maxDaily, setMaxDaily] = React.useState(String(policy.max_daily_penalty_pct))
    const [outGeofence, setOutGeofence] = React.useState(String(policy.out_of_geofence_penalty_pct))

    React.useEffect(() => {
        setEffectiveFrom(policy.effective_from)
        setEffectiveTo(policy.effective_to ?? "")
        setMissingCheckout(String(policy.missing_checkout_penalty_pct))
        setLateTolerance(String(policy.late_tolerance_minutes))
        setLatePenalty(String(policy.late_penalty_per_minute_pct))
        setMaxDaily(String(policy.max_daily_penalty_pct))
        setOutGeofence(String(policy.out_of_geofence_penalty_pct))
    }, [policy])

    const submit = () => {
        onSave({
            effective_from: effectiveFrom,
            effective_to: effectiveTo.trim() ? effectiveTo.trim() : null,
            missing_checkout_penalty_pct: num(missingCheckout),
            late_tolerance_minutes: Math.max(0, Math.round(num(lateTolerance))),
            late_penalty_per_minute_pct: num(latePenalty),
            max_daily_penalty_pct: num(maxDaily),
            out_of_geofence_penalty_pct: num(outGeofence),
        })
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <Label>Effective From</Label>
                    <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}
                           disabled={disabled}/>
                </div>
                <div className="space-y-1">
                    <Label>Effective To (opsional)</Label>
                    <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)}
                           disabled={disabled}/>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="space-y-1">
                    <Label>Missing Checkout Penalty (%)</Label>
                    <Input value={missingCheckout} onChange={(e) => setMissingCheckout(e.target.value)}
                           disabled={disabled}/>
                </div>
                <div className="space-y-1">
                    <Label>Late Tolerance (menit)</Label>
                    <Input value={lateTolerance} onChange={(e) => setLateTolerance(e.target.value)}
                           disabled={disabled}/>
                </div>
                <div className="space-y-1">
                    <Label>Late Penalty / menit (%)</Label>
                    <Input value={latePenalty} onChange={(e) => setLatePenalty(e.target.value)} disabled={disabled}/>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1">
                    <Label>Max Daily Penalty (%)</Label>
                    <Input value={maxDaily} onChange={(e) => setMaxDaily(e.target.value)} disabled={disabled}/>
                </div>
                <div className="space-y-1">
                    <Label>Out of Geofence Penalty (%)</Label>
                    <Input value={outGeofence} onChange={(e) => setOutGeofence(e.target.value)} disabled={disabled}/>
                </div>
            </div>

            <div className="flex gap-2">
                <Button onClick={submit} disabled={disabled || saving}>
                    Simpan Policy
                </Button>
            </div>
        </div>
    )
}

function LeaveRulesEditor({
                              policyId,
                              disabled,
                          }: {
    policyId?: string
    disabled?: boolean
}) {
    const rulesQ = useLeaveRules(policyId)
    const saveMut = useSaveLeaveRules(policyId ?? "")

    // Local state: include counts_as_present
    const [rows, setRows] = React.useState<
        { leave_type: LeaveType; credit: number; counts_as_present: boolean }[]
    >([])

    React.useEffect(() => {
        if (!rulesQ.data) return

        // normalize from API:
        // - jika backend sudah kirim counts_as_present -> pakai
        // - jika tidak -> default true
        const map = new Map<
            LeaveType,
            { credit: number; counts_as_present: boolean }
        >()

        for (const r of rulesQ.data as any[]) {
            map.set(r.leave_type, {
                credit: Number(r.credit ?? 0),
                counts_as_present: r.counts_as_present ?? true,
            })
        }

        setRows(
            LEAVE_TYPES.map((t) => {
                const v = map.get(t)
                return {
                    leave_type: t,
                    credit: v?.credit ?? 0,
                    counts_as_present: v?.counts_as_present ?? true,
                }
            })
        )
    }, [rulesQ.data])

    const setCredit = (t: LeaveType, v: string) => {
        // allow decimal like 0.8
        const n = Number(v)
        const credit = Number.isFinite(n) ? n : 0
        setRows((prev) =>
            prev.map((x) => (x.leave_type === t ? {...x, credit} : x))
        )
    }

    const setCountsAsPresent = (t: LeaveType, v: boolean) => {
        setRows((prev) =>
            prev.map((x) =>
                x.leave_type === t ? {...x, counts_as_present: v} : x
            )
        )
    }

    const save = async () => {
        try {
            if (!policyId) return

            // sanitize: clamp 0..1
            const payloadRules = rows.map((r) => ({
                leave_type: r.leave_type,
                credit: Math.max(0, Math.min(1, Number(r.credit ?? 0))),
                counts_as_present: Boolean(r.counts_as_present),
            }))

            await saveMut.mutateAsync({rules: payloadRules} as any)
            toast.success("Leave rules tersimpan")
        } catch (e: unknown) {
            toast.error(apiErrorMessage(e))
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium">Leave Credit Rules</p>
                    <p className="text-xs text-muted-foreground">
                        Nilai 0..1. Contoh: CUTI = 1.0, IJIN = 0.8
                    </p>
                </div>
                <Button
                    variant="outline"
                    onClick={save}
                    disabled={disabled || saveMut.isPending || rulesQ.isLoading || !policyId}
                >
                    Simpan Leave Rules
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Tipe</TableHead>
                            <TableHead className="text-right w-[140px]">Credit</TableHead>
                            <TableHead className="text-right w-[220px]">
                                Counts as Present
                            </TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {rulesQ.isLoading ? (
                            <TableRow>
                                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                                    Memuat...
                                </TableCell>
                            </TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                                    Tidak ada rule
                                </TableCell>
                            </TableRow>
                        ) : (
                            rows.map((r) => (
                                <TableRow key={r.leave_type}>
                                    <TableCell>{r.leave_type}</TableCell>

                                    <TableCell className="text-right">
                                        <Input
                                            className="w-28 text-right ml-auto"
                                            type="number"
                                            step="0.01"
                                            inputMode="decimal"
                                            value={String(r.credit)}
                                            onChange={(e) => setCredit(r.leave_type, e.target.value)}
                                            disabled={disabled}
                                        />
                                    </TableCell>

                                    <TableCell className="text-right">
                                        <div className="flex items-center justify-end gap-2">
                      <span className="text-xs text-muted-foreground">
                        {r.counts_as_present ? "YA" : "TIDAK"}
                      </span>
                                            <Input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={r.counts_as_present}
                                                onChange={(e) => setCountsAsPresent(r.leave_type, e.target.checked)}
                                                disabled={disabled}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}


function CreatePolicyDialog({
                                open,
                                onOpenChange,
                                defaultScope,
                                defaultSatkerId,
                                onCreate,
                                busy,
                            }: {
    open: boolean
    onOpenChange: (v: boolean) => void
    defaultScope: PolicyScope
    defaultSatkerId?: string
    onCreate: (payload: CreateTukinPolicyReq) => void
    busy?: boolean
}) {
    const [scope, setScope] = React.useState<PolicyScope>(defaultScope)
    const [effectiveFrom, setEffectiveFrom] = React.useState(() => dayjs().startOf("month").format("YYYY-MM-DD"))
    const [effectiveTo, setEffectiveTo] = React.useState<string>("")

    const [missingCheckout, setMissingCheckout] = React.useState("25")
    const [lateTolerance, setLateTolerance] = React.useState("0")
    const [latePenalty, setLatePenalty] = React.useState("0")
    const [maxDaily, setMaxDaily] = React.useState("100")
    const [outGeofence, setOutGeofence] = React.useState("0")

    React.useEffect(() => {
        if (!open) return
        setScope(defaultScope)
        setEffectiveFrom(dayjs().startOf("month").format("YYYY-MM-DD"))
        setEffectiveTo("")
        setMissingCheckout("25")
        setLateTolerance("0")
        setLatePenalty("0")
        setMaxDaily("100")
        setOutGeofence("0")
    }, [open, defaultScope])

    const submit = () => {
        onCreate({
            scope,
            satker_id: scope === "SATKER" ? defaultSatkerId : null,
            effective_from: effectiveFrom,
            effective_to: effectiveTo.trim() ? effectiveTo.trim() : null,
            missing_checkout_penalty_pct: num(missingCheckout),
            late_tolerance_minutes: Math.max(0, Math.round(num(lateTolerance))),
            late_penalty_per_minute_pct: num(latePenalty),
            max_daily_penalty_pct: num(maxDaily),
            out_of_geofence_penalty_pct: num(outGeofence),
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Buat Tukin Policy</DialogTitle>
                    <DialogDescription>
                        Policy dipakai untuk perhitungan tukin (penalty & credit leave). Untuk v1, buat 1 policy aktif
                        per satker.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1">
                        <Label>Scope</Label>
                        <Input value={scopeLabel(scope)} readOnly/>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                            <Label>Effective From</Label>
                            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}
                                   disabled={busy}/>
                        </div>
                        <div className="space-y-1">
                            <Label>Effective To (opsional)</Label>
                            <Input type="date" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)}
                                   disabled={busy}/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-1">
                            <Label>Missing Checkout Penalty (%)</Label>
                            <Input value={missingCheckout} onChange={(e) => setMissingCheckout(e.target.value)}
                                   disabled={busy}/>
                        </div>
                        <div className="space-y-1">
                            <Label>Late Tolerance (menit)</Label>
                            <Input value={lateTolerance} onChange={(e) => setLateTolerance(e.target.value)}
                                   disabled={busy}/>
                        </div>
                        <div className="space-y-1">
                            <Label>Late Penalty / menit (%)</Label>
                            <Input value={latePenalty} onChange={(e) => setLatePenalty(e.target.value)}
                                   disabled={busy}/>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                            <Label>Max Daily Penalty (%)</Label>
                            <Input value={maxDaily} onChange={(e) => setMaxDaily(e.target.value)} disabled={busy}/>
                        </div>
                        <div className="space-y-1">
                            <Label>Out of Geofence Penalty (%)</Label>
                            <Input value={outGeofence} onChange={(e) => setOutGeofence(e.target.value)}
                                   disabled={busy}/>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
                        Batal
                    </Button>
                    <Button onClick={submit} disabled={busy}>
                        Buat
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function TukinPolicyPage() {
    const session = getSession()
    const role = session?.role ?? "SUPERADMIN"
    const isSuper = role === "SUPERADMIN"

    const [satkerFilter, setSatkerFilter] = React.useState<string>(isSuper ? "ALL" : session?.satkerId ?? "")

    const satkersQ = useSatkers()
    const satkers = satkersQ.data ?? []

    const effectiveSatkerId = isSuper ? (satkerFilter !== "ALL" ? satkerFilter : undefined) : session?.satkerId

    const policiesQ = useTukinPolicies(effectiveSatkerId)
    const policies = policiesQ.data ?? []

    //const delMut = useDeleteTukinPolicy()

    //const delMut = useDeleteTukinPolicy(effectiveSatkerId)
    const delMut = useDeleteTukinPolicy()

    const globalPolicies = React.useMemo(() => policies.filter((p) => p.scope === "GLOBAL"), [policies])
    const newestGlobalId = React.useMemo(() => {
        if (globalPolicies.length === 0) return null
        // data backend sudah order effective_from DESC untuk global
        // tapi biar aman:
        const sorted = [...globalPolicies].sort((a, b) => (a.effective_from < b.effective_from ? 1 : -1))
        return sorted[0].id
    }, [globalPolicies])

    const canDeletePolicy = (p: TukinPolicy) => {
        // SATKER policy: boleh dihapus semua (sesuai kebutuhanmu)
        if (p.scope === "SATKER") return true

        // GLOBAL policy: hanya saat sedang lihat global (satkerFilter === "ALL") dan superadmin
        if (!isSuper) return false
        if (satkerFilter !== "ALL") return false
        if (globalPolicies.length < 2) return false
        if (p.id === newestGlobalId) return false
        return true
    }

    const [selectedId, setSelectedId] = React.useState<string>("")
    const selected = React.useMemo(() => policies.find((p) => p.id === selectedId) ?? null, [policies, selectedId])

    React.useEffect(() => {
        // Auto select first policy when loaded
        if (!selectedId && policies.length > 0) setSelectedId(policies[0].id)
    }, [policies, selectedId])

    const canEditSelected = React.useMemo(() => {
        if (!selected) return false
        if (selected.scope === "GLOBAL" && !isSuper) return false
        return true
    }, [selected, isSuper])

    const createMut = useCreateTukinPolicy()
    const updateMut = useUpdateTukinPolicy()

    const [createOpen, setCreateOpen] = React.useState(false)

    const createDefaultScope: PolicyScope = isSuper && satkerFilter === "ALL" ? "GLOBAL" : "SATKER"

    const createPolicy = async (payload: CreateTukinPolicyReq) => {
        try {
            await createMut.mutateAsync(payload)
            setCreateOpen(false)
        } catch (e: unknown) {
            toast.error(apiErrorMessage(e))
        }
    }

    const savePolicy = async (patch: {
        effective_from: string
        effective_to?: string | null
        missing_checkout_penalty_pct: number
        late_tolerance_minutes: number
        late_penalty_per_minute_pct: number
        max_daily_penalty_pct: number
        out_of_geofence_penalty_pct: number
    }) => {
        try {
            if (!selected) return
            await updateMut.mutateAsync({
                id: selected.id,
                body: {
                    effective_from: patch.effective_from,
                    effective_to: patch.effective_to,
                    missing_checkout_penalty_pct: patch.missing_checkout_penalty_pct,
                    late_tolerance_minutes: patch.late_tolerance_minutes,
                    late_penalty_per_minute_pct: patch.late_penalty_per_minute_pct,
                    max_daily_penalty_pct: patch.max_daily_penalty_pct,
                    out_of_geofence_penalty_pct: patch.out_of_geofence_penalty_pct,
                },
            })
        } catch (e: unknown) {
            toast.error(apiErrorMessage(e))
        }
    }

    const showCreateSatker = isSuper ? satkerFilter !== "ALL" : true

    return (
        <Card>
            <CardHeader>
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <CardTitle>Tukin Policy</CardTitle>
                    <div className="flex items-center gap-2">
                        {isSuper ? (
                            <div className="w-[320px]">
                                <SatkerSelect
                                    value={satkerFilter}
                                    onChange={setSatkerFilter}
                                    items={satkers.filter((s) => s.is_active)}
                                    allowAll
                                    allLabel="Global (tanpa satker)"
                                    allValue="ALL"
                                    placeholder={satkersQ.isLoading ? "Memuat..." : "Pilih satker"}
                                    disabled={satkersQ.isLoading}
                                />
                            </div>
                        ) : null}

                        {isSuper && satkerFilter === "ALL" ? (
                            <Button variant="outline" onClick={() => setCreateOpen(true)}
                                    disabled={createMut.isPending}>
                                Buat Policy Global
                            </Button>
                        ) : showCreateSatker ? (
                            <Button variant="outline" onClick={() => setCreateOpen(true)}
                                    disabled={createMut.isPending}>
                                Buat Policy Satker
                            </Button>
                        ) : null}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {isSuper && satkerFilter === "ALL" ? (
                    <p className="text-sm text-muted-foreground">
                        Kamu sedang melihat policy GLOBAL saja. Pilih satker jika ingin mengatur policy satker.
                    </p>
                ) : null}

                <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                    <div className="rounded-md border md:col-span-1">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Policy</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {policiesQ.isLoading ? (
                                    <TableRow>
                                        <TableCell
                                            className="py-6 text-center text-muted-foreground">Memuat...</TableCell>
                                    </TableRow>
                                ) : policies.length === 0 ? (
                                    <TableRow>
                                        <TableCell className="py-6 text-center text-muted-foreground">Tidak ada
                                            policy</TableCell>
                                    </TableRow>
                                ) : (
                                    policies.map((p) => (
                                        <TableRow
                                            key={p.id}
                                            className={p.id === selectedId ? "bg-muted/50" : ""}
                                            onClick={() => setSelectedId(p.id)}
                                            style={{cursor: "pointer"}}
                                        >
                                            {/*<TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">{scopeLabel(p.scope)}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.scope === "SATKER" ? `${p.satker_code ?? ""} - ${p.satker_name ?? ""}` : "GLOBAL"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.effective_from} {p.effective_to ? `→ ${p.effective_to}` : ""}
                          </div>
                        </div>
                      </TableCell>*/}

                                            <TableCell>
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="space-y-1">
                                                        <div className="text-sm font-medium">{scopeLabel(p.scope)}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {p.scope === "SATKER" ? `${p.satker_code ?? ""} - ${p.satker_name ?? ""}` : "GLOBAL"}
                                                        </div>
                                                        <div className="text-xs text-muted-foreground">
                                                            {p.effective_from} {p.effective_to ? `→ ${p.effective_to}` : ""}
                                                        </div>
                                                    </div>

                                                    {canDeletePolicy(p) ? (
                                                        <ConfirmDialog
                                                            trigger={
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation() // biar klik hapus gak ikut select row
                                                                    }}
                                                                >
                                                                    Hapus
                                                                </Button>
                                                            }
                                                            title="Hapus tukin policy?"
                                                            description={
                                                                <span className="text-sm">
            Policy <b>{scopeLabel(p.scope)}</b> dengan effective_from <b>{p.effective_from}</b> akan dihapus.
          </span>
                                                            }
                                                            confirmText="Hapus"
                                                            destructive
                                                            loading={delMut.isPending}
                                                            onConfirm={async () => {
                                                                try {
                                                                    await delMut.mutateAsync(p.id)
                                                                    toast.success("Policy dihapus")

                                                                    // kalau yang dihapus kebetulan selected, pindah selection ke policy pertama
                                                                    /*if (selectedId === p.id) {
                                                                        const remain = policies.filter((x) => x.id !== p.id)
                                                                        setSelectedId(remain[0]?.id ?? "")
                                                                    }*/
                                                                    if (selectedId === p.id) {
                                                                        const next = policies.filter((x) => x.id !== p.id)[0]?.id ?? ""
                                                                        setSelectedId(next)
                                                                    }
                                                                } catch (e: any) {
                                                                    toast.error(e?.response?.data?.message ?? "Gagal menghapus policy")
                                                                }
                                                            }}
                                                        />
                                                    ) : null}
                                                </div>
                                            </TableCell>


                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="space-y-6 md:col-span-2">
                        {!selected ? (
                            <div className="rounded-md border p-6 text-center text-muted-foreground">Pilih policy untuk
                                mengedit</div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <p className="text-sm text-muted-foreground">
                                        {selected.scope === "GLOBAL" ? "Policy ini GLOBAL." : "Policy ini khusus satker."}
                                        {!canEditSelected ? " (Read-only)" : ""}
                                    </p>
                                    <PolicyForm
                                        policy={selected}
                                        disabled={!canEditSelected}
                                        saving={updateMut.isPending}
                                        onSave={savePolicy}
                                    />
                                </div>

                                <LeaveRulesEditor policyId={selected.id} disabled={!canEditSelected}/>
                            </>
                        )}
                    </div>
                </div>
            </CardContent>

            <CreatePolicyDialog
                open={createOpen}
                onOpenChange={setCreateOpen}
                defaultScope={createDefaultScope}
                defaultSatkerId={createDefaultScope === "SATKER" ? effectiveSatkerId : undefined}
                busy={createMut.isPending}
                onCreate={createPolicy}
            />
        </Card>
    )
}
