import * as React from "react"
import { useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useCalendarDays } from "@/features/calendar/hooks"
import type { CalendarDay } from "@/features/calendar/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function hhmm(v: string | null | undefined) {
  if (!v) return "-"
  return v.slice(0, 5)
}

export default function CalendarResultPage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const { data: satkers = [] } = useSatkers()

  const [params, setParams] = useSearchParams()
  const [satkerId, setSatkerId] = React.useState<string>(() => {
    if (role === "SATKER_ADMIN") return session?.satkerId ?? ""
    return params.get("satkerId") ?? ""
  })
  const [from, setFrom] = React.useState<string>(() => params.get("from") ?? "")
  const [to, setTo] = React.useState<string>(() => params.get("to") ?? "")

  React.useEffect(() => {
    if (role === "SATKER_ADMIN") {
      if (session?.satkerId && satkerId !== session.satkerId) setSatkerId(session.satkerId)
      return
    }
    if (!satkerId && satkers.length > 0) setSatkerId(satkers[0].id)
  }, [role, session?.satkerId, satkerId, satkers])

  const query = React.useMemo(() => {
    if (!satkerId || !from || !to) return null
    return { satkerId, from, to }
  }, [satkerId, from, to])

  const q = useCalendarDays(query)

  const applyToUrl = () => {
    if (!satkerId || !from || !to) {
      toast.error("satker/from/to wajib")
      return
    }
    setParams({ satkerId, from, to })
  }

  const rows: CalendarDay[] = q.data ?? []

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Calendar Result</h1>
        <p className="text-sm text-muted-foreground">Lihat hasil generate kalender (satker_calendar_days).</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filter</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {role === "SUPERADMIN" ? (
            <div className="max-w-xl space-y-2">
              <Label>Satker</Label>
              <SatkerSelect value={satkerId} onChange={setSatkerId} items={satkers} />
            </div>
          ) : (
            <div className="text-sm">
              <span className="font-medium">Satker: </span>
              {session?.satkerCode} - {session?.satkerName}
            </div>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <Button variant="outline" onClick={applyToUrl} disabled={!satkerId || !from || !to}>
              Terapkan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Daftar Hari</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">Tanggal</TableHead>
                  <TableHead className="w-[120px]">Type</TableHead>
                  <TableHead className="w-[120px]">Start</TableHead>
                  <TableHead className="w-[120px]">End</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.work_date}>
                    <TableCell>{r.work_date}</TableCell>
                    <TableCell>{r.day_type}</TableCell>
                    <TableCell>{hhmm(r.expected_start)}</TableCell>
                    <TableCell>{hhmm(r.expected_end)}</TableCell>
                    <TableCell>{r.note ?? "-"}</TableCell>
                  </TableRow>
                ))}
                {q.isLoading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Loading...
                    </TableCell>
                  </TableRow>
                )}
                {!q.isLoading && rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      Belum ada data. Pastikan sudah generate kalender untuk range ini.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
