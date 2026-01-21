import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAttendanceCountsBySatker } from "@/features/dashboard/hooks"
import type { SatkerAttendanceCountRow } from "@/features/dashboard/types"
import { apiErrorMessage } from "@/lib/api-error"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

function todayLocalISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function addDaysISO(iso: string, deltaDays: number): string {
  // iso = YYYY-MM-DD (local)
  const [y, m, d] = iso.split("-").map((v) => Number(v))
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  dt.setDate(dt.getDate() + deltaDays)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, "0")
  const dd = String(dt.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export default function DashboardPage() {
  const role = getSession()?.role
  const allowed = role === "SUPERADMIN" || role === "SATKER_ADMIN"
  if (!allowed) {
    return (
        <Card>
          <CardHeader>
            <CardTitle>Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">Tidak punya akses.</div>
          </CardContent>
        </Card>
    )
  }

  const [date, setDate] = React.useState<string>(() => todayLocalISO())
  const [chartMode, setChartMode] = React.useState<"counts" | "pct">("counts")
  const [sortKey, setSortKey] = React.useState<"hadir" | "total" | "pct">("hadir")
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc")
  const { data, isLoading, error } = useAttendanceCountsBySatker(date)

  React.useEffect(() => {
    if (error) toast.error(apiErrorMessage(error))
  }, [error])

  const EXCLUDED_SATKER_ID = "11111111-1111-1111-1111-111111111111"
  const EXCLUDED_SATKER_CODE = "111111"

  const rows = (data?.data ?? []).filter((r) => {
    if (!r) return false
    if (r.satker_id === EXCLUDED_SATKER_ID) return false
    if ((r.satker_code || "").trim() === EXCLUDED_SATKER_CODE) return false
    return true
  })

  const sortedRows = React.useMemo(() => {
    const arr = [...rows]
    const getVal = (r: SatkerAttendanceCountRow) => {
      if (sortKey === "hadir") return Number(r.checked_in_count || 0)
      if (sortKey === "total") return Number(r.total_users || 0)
      return Number(r.present_pct || 0)
    }
    arr.sort((a, b) => {
      const va = getVal(a)
      const vb = getVal(b)
      if (va < vb) return sortDir === "asc" ? -1 : 1
      if (va > vb) return sortDir === "asc" ? 1 : -1
      // tie-breaker: satker_code
      return String(a.satker_code || "").localeCompare(String(b.satker_code || ""))
    })
    return arr
  }, [rows, sortKey, sortDir])
  const totalChecked = rows.reduce((s, r) => s + (r.checked_in_count || 0), 0)
  const totalUsers = rows.reduce((s, r) => s + (r.total_users || 0), 0)
  const avgPct = totalUsers > 0 ? Math.round((totalChecked / totalUsers) * 10000) / 100 : 0

  const chartRows = sortedRows.map((r) => ({
    name: r.satker_code,
    hadir: r.checked_in_count,
    total: r.total_users,
    persen: r.present_pct,
  }))

  const sortLabel = (key: "hadir" | "total" | "pct") => {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ↑" : " ↓"
  }

  const toggleSort = (key: "hadir" | "total" | "pct") => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const top5ByHadir = React.useMemo(() => {
    const arr = [...rows]
    arr.sort((a, b) => Number(b.checked_in_count || 0) - Number(a.checked_in_count || 0))
    return arr.slice(0, 5)
  }, [rows])

  return (
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">Dashboard</h1>
            <p className="text-sm text-muted-foreground">Rekap absensi per satker berdasarkan tanggal.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDate(todayLocalISO())}>
              Hari ini
            </Button>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDate(addDaysISO(todayLocalISO(), -1))}
            >
              Kemarin
            </Button>
            <div className="w-[180px]">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Jumlah hadir (check-in)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totalChecked}</div>
              <div className="text-xs text-muted-foreground">Total seluruh satker (sesuai hak akses).</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total user aktif</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totalUsers}</div>
              <div className="text-xs text-muted-foreground">Tidak termasuk SUPERADMIN dan SATKER_ADMIN.</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Persentase hadir</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{avgPct}%</div>
              <div className="text-xs text-muted-foreground">(checked-in / total user aktif) × 100</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Top 5 Satker Hadir Tertinggi</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="text-sm text-muted-foreground">Memuat...</div>
            ) : top5ByHadir.length === 0 ? (
                <div className="text-sm text-muted-foreground">Tidak ada data.</div>
            ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {top5ByHadir.map((r) => (
                      <div
                          key={r.satker_id}
                          className="flex items-center justify-between gap-3 rounded-lg border p-3"
                      >
                        <div>
                          <div className="font-medium">{r.satker_name}</div>
                          <div className="text-xs text-muted-foreground">{r.satker_code}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold">{r.checked_in_count} hadir</div>
                          <div className="text-xs text-muted-foreground">{r.present_pct}%</div>
                        </div>
                      </div>
                  ))}
                </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <CardTitle>Grafik Kehadiran</CardTitle>
              <Tabs value={chartMode} onValueChange={(v) => setChartMode(v as "counts" | "pct")}>
                <TabsList>
                  <TabsTrigger value="counts">Hadir vs Total</TabsTrigger>
                  <TabsTrigger value="pct">Persentase (%)</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  {chartMode === "pct" ? <YAxis domain={[0, 100]} /> : <YAxis />}
                  <Tooltip />
                  <Legend />
                  {chartMode === "counts" ? (
                      <>
                        <Bar dataKey="hadir" name="Hadir (check-in)" fill="#22c55e" />
                        <Bar dataKey="total" name="Total user" fill="#3b82f6" />
                      </>
                  ) : (
                      <Bar dataKey="persen" name="Persentase hadir (%)" fill="#f59e0b" />
                  )}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detail per Satker</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
                <div className="text-sm text-muted-foreground">Memuat...</div>
            ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Satker</TableHead>
                      <TableHead
                          className="cursor-pointer select-none text-right"
                          onClick={() => toggleSort("hadir")}
                      >
                        Hadir{sortLabel("hadir")}
                      </TableHead>
                      <TableHead
                          className="cursor-pointer select-none text-right"
                          onClick={() => toggleSort("total")}
                      >
                        Total user{sortLabel("total")}
                      </TableHead>
                      <TableHead
                          className="cursor-pointer select-none text-right"
                          onClick={() => toggleSort("pct")}
                      >
                        %{sortLabel("pct")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedRows.map((r) => (
                        <TableRow key={r.satker_id}>
                          <TableCell>
                            <div className="font-medium">{r.satker_name}</div>
                            <div className="text-xs text-muted-foreground">{r.satker_code}</div>
                          </TableCell>
                          <TableCell className="text-right">{r.checked_in_count}</TableCell>
                          <TableCell className="text-right">{r.total_users}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary">{r.present_pct}%</Badge>
                          </TableCell>
                        </TableRow>
                    ))}
                    {sortedRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-sm text-muted-foreground">
                            Tidak ada data.
                          </TableCell>
                        </TableRow>
                    )}
                  </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>
  )
}
