import * as React from "react"

import { getSession } from "@/lib/auth"

import {
  useApproveLeaveRequest,
  useDecidedLeaveRequests,
  usePendingLeaveRequests,
  useRejectLeaveRequest,
} from "@/features/leave-requests/hooks"
import type {
  LeaveRequestDto,
  PendingLeaveRequestDto,
} from "@/features/leave-requests/types"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  // day 0 of next month = last day of current month
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function defaultLeaveRange(now: Date) {
  const from = startOfMonth(now)
  // end of next month
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const to = endOfMonth(nextMonth)
  return { from: ymd(from), to: ymd(to) }
}

function fmtDateId(ymdStr?: string) {
  if (!ymdStr) return "-"
  try {
    const d = new Date(`${ymdStr}T00:00:00`)
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(d)
  } catch {
    return ymdStr
  }
}

function typeLabel(t: string) {
  switch (t) {
    case "IJIN":
      return "Ijin"
    case "SAKIT":
      return "Sakit"
    case "CUTI":
      return "Cuti"
    case "DINAS_LUAR":
      return "Dinas Luar"
    default:
      return t
  }
}

type DecisionMode = "approve" | "reject"

function DecisionDialog({
  open,
  onOpenChange,
  mode,
  row,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: DecisionMode
  row: PendingLeaveRequestDto | null
  onSubmit: (note?: string) => void
  loading?: boolean
}) {
  const [note, setNote] = React.useState<string>("")

  React.useEffect(() => {
    if (open) setNote("")
  }, [open])

  const title = mode === "approve" ? "Approve Leave Request" : "Reject Leave Request"
  const actionText = mode === "approve" ? "Approve" : "Reject"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        {!row ? (
          <div className="text-sm text-muted-foreground">Data tidak ditemukan.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-md border p-3 text-sm">
              <div className="font-medium">{row.requester_name}</div>
              <div className="text-muted-foreground">NRP: {row.requester_nrp}</div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{row.satker_code}</Badge>
                <Badge variant="outline">{typeLabel(row.tipe)}</Badge>
                <Badge>{fmtDateId(row.start_date)} → {fmtDateId(row.end_date)}</Badge>
              </div>
              {row.reason ? <div className="mt-2">Alasan: {row.reason}</div> : null}
            </div>

            <div className="space-y-2">
              <Label>Catatan (opsional)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Tambahkan catatan untuk pemohon..." />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Batal
              </Button>
              <Button
                variant={mode === "reject" ? "destructive" : "default"}
                onClick={() => onSubmit(note.trim() ? note.trim() : undefined)}
                disabled={loading}
              >
                {loading ? "Memproses..." : actionText}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function PendingTable({
  rows,
  canDecide,
  onApprove,
  onReject,
}: {
  rows: PendingLeaveRequestDto[]
  canDecide: boolean
  onApprove: (row: PendingLeaveRequestDto) => void
  onReject: (row: PendingLeaveRequestDto) => void
}) {
  return (
    <div className="overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left">Satker</th>
            <th className="px-3 py-2 text-left">Pemohon</th>
            <th className="px-3 py-2 text-left">Tipe</th>
            <th className="px-3 py-2 text-left">Tanggal</th>
            <th className="px-3 py-2 text-left">Alasan</th>
            <th className="px-3 py-2 text-right">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                Tidak ada leave request yang menunggu.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.satker_code}</div>
                  <div className="text-xs text-muted-foreground">{r.satker_name}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.requester_name}</div>
                  <div className="text-xs text-muted-foreground">{r.requester_nrp}</div>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{typeLabel(r.tipe)}</Badge>
                </td>
                <td className="px-3 py-2">
                  {fmtDateId(r.start_date)} → {fmtDateId(r.end_date)}
                </td>
                <td className="px-3 py-2">{r.reason ?? "-"}</td>
                <td className="px-3 py-2 text-right">
                  {canDecide ? (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onReject(r)}>
                        Reject
                      </Button>
                      <Button size="sm" onClick={() => onApprove(r)}>
                        Approve
                      </Button>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

function DecidedTable({ rows }: { rows: LeaveRequestDto[] }) {
  return (
    <div className="overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-3 py-2 text-left">Satker</th>
            <th className="px-3 py-2 text-left">Pemohon</th>
            <th className="px-3 py-2 text-left">Tipe</th>
            <th className="px-3 py-2 text-left">Tanggal</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Diputuskan oleh</th>
            <th className="px-3 py-2 text-left">Catatan</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-3 py-6 text-center text-muted-foreground" colSpan={7}>
                Tidak ada data pada rentang tanggal ini.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-3 py-2">
                  <div className="font-medium">{r.satker_code}</div>
                  <div className="text-xs text-muted-foreground">{r.satker_name}</div>
                </td>
                <td className="px-3 py-2">
                  <div className="font-medium">{r.user_full_name}</div>
                  <div className="text-xs text-muted-foreground">{r.user_nrp}</div>
                </td>
                <td className="px-3 py-2">
                  <Badge variant="outline">{typeLabel(r.tipe)}</Badge>
                </td>
                <td className="px-3 py-2">
                  {fmtDateId(r.start_date)} → {fmtDateId(r.end_date)}
                </td>
                <td className="px-3 py-2">
                  <Badge variant={r.status === "APPROVED" ? "default" : "destructive"}>{r.status}</Badge>
                </td>
                <td className="px-3 py-2">{r.approver_full_name ?? "-"}</td>
                <td className="px-3 py-2">{r.decision_note ?? "-"}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default function LeaveRequestsPage() {
  const role = (getSession()?.role ?? "SUPERADMIN") as string
  const isSuper = role === "SUPERADMIN"
  const canView = isSuper || role === "SATKER_ADMIN" || role === "SATKER_HEAD"
  const canDecide = isSuper || role === "SATKER_ADMIN" || role === "SATKER_HEAD"

  const initRange = React.useMemo(() => defaultLeaveRange(new Date()), [])
  const [from, setFrom] = React.useState(() => initRange.from)
  const [to, setTo] = React.useState(() => initRange.to)

  // Filter satker (hanya untuk superadmin)
  const satkersQ = useSatkers()
  const satkers = satkersQ.data ?? []
  const [satkerFilter, setSatkerFilter] = React.useState<string>("ALL")
  const satkerId = isSuper && satkerFilter !== "ALL" ? satkerFilter : undefined

  const pendingQ = usePendingLeaveRequests({ satkerId }, canView)
  const decidedQ = useDecidedLeaveRequests({ from, to, satkerId }, canView)

  const approveM = useApproveLeaveRequest()
  const rejectM = useRejectLeaveRequest()

  const [dlgOpen, setDlgOpen] = React.useState(false)
  const [dlgMode, setDlgMode] = React.useState<DecisionMode>("approve")
  const [dlgRow, setDlgRow] = React.useState<PendingLeaveRequestDto | null>(null)

  const openApprove = (row: PendingLeaveRequestDto) => {
    setDlgMode("approve")
    setDlgRow(row)
    setDlgOpen(true)
  }
  const openReject = (row: PendingLeaveRequestDto) => {
    setDlgMode("reject")
    setDlgRow(row)
    setDlgOpen(true)
  }

  const submitDecision = async (note?: string) => {
    if (!dlgRow) return
    if (dlgMode === "approve") {
      approveM.mutate(
        { id: dlgRow.id, body: { note } },
        {
          onSuccess: () => setDlgOpen(false),
        }
      )
    } else {
      rejectM.mutate(
        { id: dlgRow.id, body: { note } },
        {
          onSuccess: () => setDlgOpen(false),
        }
      )
    }
  }

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border p-4 text-sm text-muted-foreground">Anda tidak memiliki akses.</div>
        </CardContent>
      </Card>
    )
  }

  const pendingRows = pendingQ.data?.data ?? []
  const decidedRows = decidedQ.data?.data ?? []

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Leave Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={isSuper ? "grid grid-cols-1 gap-4 md:grid-cols-4" : "grid grid-cols-1 gap-4 md:grid-cols-3"}>
            <div className="space-y-1">
              <Label>Dari</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sampai</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>

            {isSuper ? (
              <div className="space-y-1">
                <Label>Satker</Label>
                <SatkerSelect
                  value={satkerFilter}
                  onChange={setSatkerFilter}
                  items={satkers.filter((x: any) => x.is_active)}
                  placeholder={satkersQ.isLoading ? "Memuat..." : "Semua satker"}
                  allowAll
                  allLabel="Semua satker"
                  allValue="ALL"
                  disabled={satkersQ.isLoading}
                />
              </div>
            ) : null}

            <div className="flex items-end">
              <div className="text-sm text-muted-foreground">
                Pending akan auto-refresh setiap 30 detik.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="decided">Approved/Rejected</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-3">
          {pendingQ.isLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Memuat...</div>
          ) : pendingQ.isError ? (
            <div className="rounded-md border p-4 text-sm text-destructive">Gagal memuat data pending.</div>
          ) : (
            <PendingTable rows={pendingRows} canDecide={canDecide} onApprove={openApprove} onReject={openReject} />
          )}
        </TabsContent>

        <TabsContent value="decided" className="space-y-3">
          {decidedQ.isLoading ? (
            <div className="rounded-md border p-4 text-sm text-muted-foreground">Memuat...</div>
          ) : decidedQ.isError ? (
            <div className="rounded-md border p-4 text-sm text-destructive">Gagal memuat riwayat.</div>
          ) : (
            <DecidedTable rows={decidedRows} />
          )}
        </TabsContent>
      </Tabs>

      <DecisionDialog
        open={dlgOpen}
        onOpenChange={setDlgOpen}
        mode={dlgMode}
        row={dlgRow}
        onSubmit={submitDecision}
        loading={approveM.isPending || rejectM.isPending}
      />
    </div>
  )
}
