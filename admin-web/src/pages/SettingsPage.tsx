import * as React from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"

import { getSession } from "@/lib/auth"
import { apiErrorMessage } from "@/lib/api-error"

import { useTimezoneQuery, useUpdateTimezoneMutation } from "@/features/settings/hooks"
import type { AppTimezone } from "@/features/settings/types"

const OPTIONS: { label: string; value: AppTimezone }[] = [
  { label: "WIB (Asia/Jakarta)", value: "Asia/Jakarta" },
  { label: "WITA (Asia/Makassar)", value: "Asia/Makassar" },
  { label: "WIT (Asia/Jayapura)", value: "Asia/Jayapura" },
]

export default function SettingsPage() {
  const session = getSession()
  const role = session?.role

  if (role !== "SUPERADMIN") {
    return (
        <div className="space-y-4">
          <h1 className="text-xl font-semibold">Settings</h1>
          <Card>
            <CardHeader>
              <CardTitle>Tidak punya akses</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Halaman ini hanya untuk SUPERADMIN.
              </p>
            </CardContent>
          </Card>
        </div>
    )
  }

  // --- timezone ---
  const tzQ = useTimezoneQuery()
  const updateM = useUpdateTimezoneMutation()
  const [tz, setTz] = React.useState<AppTimezone>("Asia/Jakarta")

  React.useEffect(() => {
    const v = tzQ.data?.timezone
    if (v) setTz(v)
  }, [tzQ.data])

  const timezoneDisabled = false

  return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Operational Timezone</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Timezone ini dipakai untuk aturan “tahun berjalan”, perhitungan kalender kerja, dan validasi range.
            </p>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={tz} onValueChange={(v) => setTz(v as AppTimezone)} disabled={timezoneDisabled}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Pilih timezone" />
                </SelectTrigger>
                <SelectContent>
                  {OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                  disabled={timezoneDisabled || updateM.isPending}
                  onClick={async () => {
                    try {
                      const res = await updateM.mutateAsync({ timezone: tz })
                      toast.success(`Timezone disimpan: ${res.data.timezone}`)
                    } catch (e) {
                      toast.error(apiErrorMessage(e))
                    }
                  }}
              >
                Simpan
              </Button>
              <div className="text-sm text-muted-foreground">
                Tahun berjalan (berdasarkan timezone): {tzQ.data?.current_year ?? "-"}
              </div>
            </div>

            {timezoneDisabled && (
                <div className="text-sm text-muted-foreground">Hanya SUPERADMIN yang bisa mengubah setting ini.</div>
            )}
          </CardContent>
        </Card>
      </div>
  )
}




/*
import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { getSession } from "@/lib/auth"
import { useTimezoneQuery, useUpdateTimezoneMutation } from "@/features/settings/hooks"
import type { AppTimezone } from "@/features/settings/types"
import { toast } from "sonner"

const OPTIONS: { label: string; value: AppTimezone }[] = [
  { label: "WIB (Asia/Jakarta)", value: "Asia/Jakarta" },
  { label: "WITA (Asia/Makassar)", value: "Asia/Makassar" },
  { label: "WIT (Asia/Jayapura)", value: "Asia/Jayapura" },
]

export default function SettingsPage() {
  const role = getSession()?.role
  const tzQ = useTimezoneQuery()
  const updateM = useUpdateTimezoneMutation()

  const [tz, setTz] = React.useState<AppTimezone>("Asia/Jakarta")

  React.useEffect(() => {
    const v = tzQ.data?.data?.timezone
    if (v) setTz(v)
  }, [tzQ.data])

  const disabled = role !== "SUPERADMIN"

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational Timezone</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Timezone ini dipakai untuk aturan “tahun berjalan”, perhitungan kalender kerja, dan validasi range.
          </p>

          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={tz} onValueChange={(v) => setTz(v as AppTimezone)} disabled={disabled}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Pilih timezone" />
              </SelectTrigger>
              <SelectContent>
                {OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              disabled={disabled || updateM.isPending}
              onClick={async () => {
                try {
                  const res = await updateM.mutateAsync({ timezone: tz })
                  toast.success(`Timezone disimpan: ${res.data.timezone}`)
                } catch (e: any) {
                  toast.error(e?.response?.data?.message ?? "Gagal menyimpan timezone")
                }
              }}
            >
              Simpan
            </Button>
            <div className="text-sm text-muted-foreground">
              Tahun berjalan (berdasarkan timezone): {tzQ.data?.data?.current_year ?? "-"}
            </div>
          </div>

          {disabled && (
            <div className="text-sm text-muted-foreground">
              Hanya SUPERADMIN yang bisa mengubah setting ini.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
*/
