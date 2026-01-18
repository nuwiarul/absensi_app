import * as React from "react"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useGenerateCalendar } from "@/features/calendar/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {apiErrorMessage} from "@/lib/api-error.ts";

function firstOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}
function lastOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

export default function CalendarGeneratePage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const { data: satkers = [] } = useSatkers()

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
  const [from, setFrom] = React.useState(firstOfMonth(now).toISOString().slice(0, 10))
  const [to, setTo] = React.useState(lastOfMonth(now).toISOString().slice(0, 10))

  const gen = useGenerateCalendar()

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
      toast.error(apiErrorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Generate Calendar</h1>
        <p className="text-sm text-muted-foreground">Urutan flow: set Work Patterns → Generate Calendar → Holiday Bulk</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
