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

import { apiErrorMessage } from "@/lib/api-error"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { useUsers } from "@/features/users/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useGenerateTukin, useTukinCalculations } from "@/features/tukin/hooks"
import type { TukinCalculationRow } from "@/features/tukin/types"

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
    <Select value={value && value.length > 0 ? value : undefined} onValueChange={onChange} disabled={disabled}>
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

  const [month, setMonth] = React.useState(() => dayjs().format("YYYY-MM"))
  const [satkerFilter, setSatkerFilter] = React.useState<string>(isSuper ? "ALL" : session?.satkerId ?? "")
  const [userFilter, setUserFilter] = React.useState<string>("ALL")

  const satkersQ = useSatkers()
  const satkers = satkersQ.data ?? []

  // User dropdown only loads once satker selected (superadmin)
  const effectiveSatkerId = isSuper ? (satkerFilter !== "ALL" ? satkerFilter : undefined) : session?.satkerId
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
      await genMut.mutateAsync({ month, satkerId: effectiveSatkerId, userId: effectiveUserId, force })
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e))
    }
  }

  const rows: TukinCalculationRow[] = calQ.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Laporan Tukin (Cache Bulanan)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1">
            <Label>Bulan</Label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={busy} />
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
                <p className="text-xs text-muted-foreground">Pilih satker terlebih dahulu untuk melihat laporan.</p>
              ) : null}
            </div>
          ) : (
            <div className="space-y-1">
              <Label>Satker</Label>
              <Input value={`${session?.satkerCode ?? ""} - ${session?.satkerName ?? ""}`} readOnly />
            </div>
          )}

          <div className="space-y-1">
            <Label>User</Label>
            <UserSelect
              value={userFilter}
              onChange={setUserFilter}
              users={users.map((u) => ({ id: u.id, full_name: u.full_name, nrp: u.nrp }))}
              disabled={!usersEnabled || usersQ.isLoading || busy}
            />
          </div>

          <div className="flex items-end gap-2">
            <Button onClick={() => generate(false)} disabled={busy || !canQuery}>
              Generate
            </Button>
            <Button variant="outline" onClick={() => generate(true)} disabled={busy || !canQuery}>
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {calQ.isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell>{r.user_full_name}</TableCell>
                    <TableCell>{r.user_nrp}</TableCell>
                    <TableCell>{r.rank_code ? `${r.rank_code} - ${r.rank_name ?? ""}` : "-"}</TableCell>
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
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
