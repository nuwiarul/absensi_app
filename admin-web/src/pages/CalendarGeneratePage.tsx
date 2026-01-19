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

/*function ymdLocal(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}*/

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

  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")

  const gen = useGenerateCalendar()

  const curYear = tzQ.data?.data?.current_year ?? new Date().getFullYear()
  const [year, setYear] = React.useState<number>(curYear)

  const setFullYear = (y: number) => {
    setFrom(`${y}-01-01`)
    setTo(`${y}-12-31`)
  }

  // default: 1 tahun penuh (boleh tahun depan juga)
  React.useEffect(() => {
    if (!from || !to) setFullYear(year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!satkerId) return
    if (!from || !to) {
      toast.error("from/to wajib diisi")
      return
    }
    try {
      const days = await gen.mutateAsync({ satkerId, from, to })
      toast.success(`Calendar generated: ${days} hari`)
    } catch (e: unknown) {
      toast.error(e?.response?.data?.message ?? "Gagal generate calendar")
    }
  }

  return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Generate Calendar</h1>
          <p className="text-sm text-muted-foreground">
            Urutan flow: Work Patterns → Holidays → Generate Calendar. Disarankan generate 1 tahun penuh agar tidak perlu generate bulanan.
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
                <Label>Tahun</Label>
                <Input
                    type="number"
                    value={year}
                    onChange={(e) => {
                      const v = parseInt(e.target.value || "0", 10)
                      setYear(v)
                      if (String(v).length === 4) setFullYear(v)
                    }}
                    min={2000}
                    max={2100}
                />
              </div>
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
              <Button variant="outline" onClick={() => setFullYear(year)}>
                1 Tahun (Set Range)
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



/*
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

  const [from, setFrom] = React.useState("")
  const [to, setTo] = React.useState("")

  const gen = useGenerateCalendar()

  const curYear = tzQ.data?.data?.current_year ?? new Date().getFullYear()
  const [year, setYear] = React.useState<number>(curYear)

  const setFullYear = (y: number) => {
    setFrom(`${y}-01-01`)
    setTo(`${y}-12-31`)
  }

  // default: 1 tahun penuh (boleh tahun depan juga)
  React.useEffect(() => {
    if (!from || !to) setFullYear(year)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async () => {
    if (!satkerId) return
    if (!from || !to) {
      toast.error("from/to wajib diisi")
      return
    }
    const yFrom = parseInt(from.slice(0, 4), 10)
    const yTo = parseInt(to.slice(0, 4), 10)
    const isFullYear = from.endsWith("-01-01") && to.endsWith("-12-31") && yFrom === yTo
    if (!isFullYear) {
      toast.error("Range harus 1 tahun penuh: 01-01 s/d 12-31")
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
          Urutan flow: Work Patterns → Holidays → Generate Calendar. Disarankan generate 1 tahun penuh agar tidak perlu generate bulanan.
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
              <Label>Tahun</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => {
                  const v = parseInt(e.target.value || "0", 10)
                  setYear(v)
                  if (String(v).length === 4) setFullYear(v)
                }}
                min={2000}
                max={2100}
              />
            </div>
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
            <Button variant="outline" onClick={() => setFullYear(year)}>
              1 Tahun (Set Range)
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
*/
