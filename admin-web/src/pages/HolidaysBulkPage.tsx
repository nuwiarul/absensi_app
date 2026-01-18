import * as React from "react"
import { toast } from "sonner"
import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useBulkUpsertHolidays } from "@/features/holidays/hooks"
import type { BulkHolidayItem, HolidayKind, HolidayScope } from "@/features/holidays/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import {apiErrorMessage} from "@/lib/api-error.ts";

function makeRow(): BulkHolidayItem {
  return {
    holiday_date: new Date().toISOString().slice(0, 10),
    name: "",
    kind: "HOLIDAY",
    half_day_end: null,
  }
}

export default function HolidaysBulkPage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const { data: satkers = [] } = useSatkers()

  const [scope, setScope] = React.useState<HolidayScope>("SATKER")
  const [satkerId, setSatkerId] = React.useState<string>(() => {
    if (role === "SATKER_ADMIN") return session?.satkerId ?? ""
    return satkers[0]?.id ?? ""
  })

  React.useEffect(() => {
    if (role === "SATKER_ADMIN") {
      if (session?.satkerId && satkerId !== session.satkerId) setSatkerId(session.satkerId)
      setScope("SATKER")
      return
    }
    if (!satkerId && satkers.length > 0) setSatkerId(satkers[0].id)
  }, [role, session?.satkerId, satkerId, satkers])

  const [items, setItems] = React.useState<BulkHolidayItem[]>([makeRow()])
  const bulk = useBulkUpsertHolidays()

  const setItem = (idx: number, patch: Partial<BulkHolidayItem>) => {
    setItems((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  const removeRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const addRow = () => setItems((p) => [...p, makeRow()])

  const submit = async () => {
    const clean = items
      .map((it) => ({ ...it, name: it.name.trim() }))
      .filter((it) => it.holiday_date && it.name)

    if (clean.length === 0) {
      toast.error("Minimal 1 baris (tanggal + nama) wajib diisi")
      return
    }

    if (scope === "NATIONAL" && role !== "SUPERADMIN") {
      toast.error("Hanya SUPERADMIN yang boleh input NATIONAL holiday")
      return
    }

    if (scope === "SATKER" && !satkerId) {
      toast.error("Satker wajib dipilih")
      return
    }

    try {
      const affected = await bulk.mutateAsync({
        scope,
        satker_id: scope === "SATKER" ? satkerId : null,
        items: clean.map((it) => ({
          holiday_date: it.holiday_date,
          name: it.name,
          kind: it.kind ?? "HOLIDAY",
          half_day_end: (it.kind ?? "HOLIDAY") === "HALF_DAY" ? (it.half_day_end ?? null) : null,
        })),
      })
      toast.success(`Holiday bulk success: ${affected} rows`)
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e))
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Holiday Bulk</h1>
        <p className="text-sm text-muted-foreground">
          Tambah/update banyak tanggal libur sekaligus (NATIONAL atau SATKER).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Target</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label>Scope</Label>
              <Select value={scope} onValueChange={(v) => setScope(v as HolidayScope)} disabled={role !== "SUPERADMIN" && scope === "NATIONAL"}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SATKER">SATKER</SelectItem>
                  <SelectItem value="NATIONAL" disabled={role !== "SUPERADMIN"}>
                    NATIONAL
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {scope === "SATKER" && (
              <div className="space-y-2">
                <Label>Satker</Label>
                {role === "SUPERADMIN" ? (
                  <div className="w-[340px]">
                    <SatkerSelect value={satkerId} onChange={setSatkerId} items={satkers} />
                  </div>
                ) : (
                  <div className="text-sm pt-2">
                    {session?.satkerCode} - {session?.satkerName}
                  </div>
                )}
              </div>
            )}

            <div className="flex-1" />
            <Button variant="outline" onClick={addRow}>
              Tambah Baris
            </Button>
            <Button onClick={submit} disabled={bulk.isPending}>
              Submit Bulk
            </Button>
          </div>

          <div className="overflow-auto rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Tanggal</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-[140px]">Kind</TableHead>
                  <TableHead className="w-[150px]">Half Day End</TableHead>
                  <TableHead className="w-[90px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Input
                        type="date"
                        value={it.holiday_date}
                        onChange={(e) => setItem(idx, { holiday_date: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        placeholder="Nama hari/libur"
                        value={it.name}
                        onChange={(e) => setItem(idx, { name: e.target.value })}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={(it.kind ?? "HOLIDAY") as HolidayKind}
                        onValueChange={(v) =>
                          setItem(idx, {
                            kind: v as HolidayKind,
                            half_day_end: v === "HALF_DAY" ? (it.half_day_end ?? "12:00") : null,
                          })
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="HOLIDAY">HOLIDAY</SelectItem>
                          <SelectItem value="HALF_DAY">HALF_DAY</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="time"
                        disabled={(it.kind ?? "HOLIDAY") !== "HALF_DAY"}
                        value={it.half_day_end ?? ""}
                        onChange={(e) => setItem(idx, { half_day_end: e.target.value || null })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" onClick={() => removeRow(idx)}>
                        Hapus
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Catatan: kind=HOLIDAY tidak boleh mengisi half_day_end. kind=HALF_DAY wajib half_day_end.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
