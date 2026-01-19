import * as React from "react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type RecapTableViewProps = {
  tz: string
  recapQ: { isLoading: boolean }
  workingDaysQ: { isLoading: boolean }
  mergedRows: any[]
  fmtDateId: (ymd?: string) => string
  fmtClock: (isoUtc?: string, tz?: string) => string
  pickDevice: (r: any) => { device_id: string; device_name: string; device_model: string }
  recapIndicator: (r: any, tz: string) => { label: string; dotClass: string } | null
  renderStatusIn: (r: any, tz: string) => React.ReactNode
  renderStatusOut: (r: any) => React.ReactNode
  openSelfie: (title: string, objectKey?: string | null) => void
  onPickDay?: (ymd: string) => void
}

export function RecapTableView(props: RecapTableViewProps) {
  const {
    tz,
    recapQ,
    workingDaysQ,
    mergedRows,
    fmtDateId,
    fmtClock,
    pickDevice,
    recapIndicator,
    renderStatusIn,
    renderStatusOut,
    openSelfie,
    onPickDay,
  } = props

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40">
          <tr>
            <th className="p-2 text-left">Tanggal</th>
            <th className="p-2 text-left">Nama</th>
            <th className="p-2 text-left">NRP</th>
            <th className="p-2 text-left">Satker</th>
            <th className="p-2 text-left">Check In ({tz})</th>
            <th className="p-2 text-left">Check Out ({tz})</th>
            <th className="p-2 text-left">Status In</th>
            <th className="p-2 text-left">Status Out</th>
            <th className="p-2 text-left">Jarak In (m)</th>
            <th className="p-2 text-left">Jarak Out (m)</th>
            <th className="p-2 text-left">Device</th>
            <th className="p-2 text-left">Selfie</th>
          </tr>
        </thead>

        <tbody>
          {recapQ.isLoading || workingDaysQ.isLoading ? (
            <tr>
              <td className="p-2" colSpan={12}>
                Memuat...
              </td>
            </tr>
          ) : mergedRows.length === 0 ? (
            <tr>
              <td className="p-2" colSpan={12}>
                Tidak ada data. Jika ingin menampilkan “hari tanpa absen”, pastikan kalender (working days) sudah di-generate.
              </td>
            </tr>
          ) : (
            mergedRows.map((r) => {
              const dev = pickDevice(r)
              const ind = recapIndicator(r, tz)
              return (
                <tr key={r.session_id} className="border-t">
                  <td className="p-2 whitespace-nowrap">{fmtDateId(r.work_date)}</td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {ind ? (
                        <span title={ind.label} className={`h-2.5 w-2.5 rounded-full ${ind.dotClass}`} />
                      ) : (
                        <span className="h-2.5 w-2.5 rounded-full bg-transparent" />
                      )}
                      <span>{r.full_name}</span>
                      {r.is_manual ? (
                        <button
                          type="button"
                          className="inline-flex"
                          title="Lihat alasan koreksi (Manual)"
                          onClick={() => onPickDay?.(r.work_date)}
                        >
                          <Badge variant="secondary" className="cursor-pointer text-[10px] px-2 py-0">
                            Manual
                          </Badge>
                        </button>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">{r.nrp}</td>
                  <td className="p-2">{r.satker_name}</td>
                  <td className="p-2 whitespace-nowrap">{fmtClock(r.check_in_at, tz)}</td>
                  <td className="p-2 whitespace-nowrap">{fmtClock(r.check_out_at, tz)}</td>
                  <td className="p-2">{renderStatusIn(r, tz)}</td>
                  <td className="p-2">{renderStatusOut(r)}</td>
                  <td className="p-2 whitespace-nowrap">
                    {r.check_in_distance_to_fence_m != null ? r.check_in_distance_to_fence_m.toFixed(1) : ""}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {r.check_out_distance_to_fence_m != null ? r.check_out_distance_to_fence_m.toFixed(1) : ""}
                  </td>
                  <td className="p-2">
                    <div className="space-y-1">
                      <div className="text-xs">{dev.device_id}</div>
                      <div className="text-xs">{dev.device_name}</div>
                      <div className="text-xs">{dev.device_model}</div>
                    </div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSelfie(`Selfie Check In - ${r.work_date}`, r.check_in_selfie_object_key)}
                      >
                        In
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSelfie(`Selfie Check Out - ${r.work_date}`, r.check_out_selfie_object_key)}
                      >
                        Out
                      </Button>
                    </div>
                  </td>
                </tr>
              )
            })
          )}
        </tbody>
      </table>
    </div>
  )
}
