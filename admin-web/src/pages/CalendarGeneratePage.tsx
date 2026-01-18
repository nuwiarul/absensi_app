import * as React from "react"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useGenerateCalendar } from "@/features/calendar/hooks"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTimezoneQuery } from "@/features/settings/hooks"

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

export default function CalendarGeneratePage() {
  const navigate = useNavigate()
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const { data: satkers = [] } = useSatkers()
  const tzQ = useTimezoneQuery()

  const [satkerId, setSatkerId] = React.useState<string>(() => {
    if (role === "SATKER_ADMIN") return session?.satkerId ?? ""
    return ""
  })

  React.useEffect(() => {
    if (role === "SATKER_ADMIN") {
      if (session?.satkerId && satkerId !== session.satkerId) setSatkerId(session.satkerId)
      return
    }
    if (!satkerId && satkers.length > 0) setSatkerId(satkers[0].id)
  }, [role, session?.satkerId, satkerId, satkers])

  const now = new Date()
  const [from, setFrom] = React.useState(ymdLocal(firstOfMonth(now)))
  const [to, setTo] = React.useState(ymdLocal(lastOfMonth(now)))

  const gen = useGenerateCalendar()

  const curYear = tzQ.data?.data?.current_year ?? new Date().getFullYear()

  const setFullYear = () => {
    setFrom(`${curYear}-01-01`)
    setTo(`${curYear}-12-31`)
  }

  const submit = async () => {
    if (!satkerId) return
    if (!from || !to) {
      toast.error("from/to wajib diisi")
      return
    }
    const yFrom = parseInt(from.slice(0, 4), 10)
    const yTo = parseInt(to.slice(0, 4), 10)
    if (yFrom !== curYear || yTo !== curYear) {
      toast.error(`Range harus dalam tahun berjalan (${curYear})`)
      return
    }
    try {
      const days = await gen.mutateAsync({ satkerId, from, to })
      toast.success(`Calendar generated: ${days} hari`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? "Gagal generate calendar")
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Generate Calendar</h1>
        <p className="text-sm text-muted-foreground">
          Urutan flow: Work Patterns → Holidays → Generate Calendar. Range hanya boleh di tahun berjalan ({curYear}).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Target</CardTitle>
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
            <Button onClick={submit} disabled={!satkerId || gen.isPending}>
              Generate
            </Button>
            <Button variant="outline" onClick={setFullYear}>
              1 Tahun Berjalan
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(`/calendar/result?satkerId=${satkerId}&from=${from}&to=${to}`)}
              disabled={!satkerId}
            >
              Lihat Hasil
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
