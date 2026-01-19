import * as React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type RecapDayDetailDialogProps = {
  open: boolean
  onOpenChange: (v: boolean) => void
  dayYmd?: string
  tz: string
  fmtDateId: (ymd?: string) => string
  fmtClock: (isoUtc?: string, tz?: string) => string
  selectedDayInfo: any | null
  statusBadgeNode: (kind: string, detail?: string) => React.ReactNode
  selectedDayRow: any | null
  statusOrFence: (leaveType: any | undefined, notes: string | undefined, geofenceName: string | undefined) => string
  pickDevice: (r: any) => { device_id: string; device_name: string; device_model: string }
  openSelfie: (title: string, objectKey?: string | null) => void
}

export function RecapDayDetailDialog(props: RecapDayDetailDialogProps) {
  const {
    open,
    onOpenChange,
    dayYmd,
    tz,
    fmtDateId,
    fmtClock,
    selectedDayInfo,
    statusBadgeNode,
    selectedDayRow,
    statusOrFence,
    pickDevice,
    openSelfie,
  } = props

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Detail - {dayYmd ? fmtDateId(dayYmd) : ""}</DialogTitle>
        </DialogHeader>

        {!dayYmd ? null : (
          <div className="space-y-4">
            {selectedDayInfo ? statusBadgeNode(selectedDayInfo.label, selectedDayInfo.detail) : null}

            {selectedDayRow?.is_manual ? (
              <div className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Manual</Badge>
                  <div className="text-xs text-muted-foreground">
                    Koreksi oleh SUPERADMIN
                    {selectedDayRow?.manual_updated_at ? ` • ${selectedDayRow.manual_updated_at}` : ""}
                  </div>
                </div>
                {selectedDayRow?.manual_note ? (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Alasan:</span> {selectedDayRow.manual_note}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Check In</div>
                <div className="mt-1 text-sm font-medium">{fmtClock(selectedDayRow?.check_in_at, tz) || "—"}</div>

                <div className="mt-2 text-xs text-muted-foreground">Geofence / Status</div>
                <div className="mt-1 text-sm">
                  {statusOrFence(
                    selectedDayRow?.check_in_attendance_leave_type,
                    selectedDayRow?.check_in_attendance_leave_notes,
                    selectedDayRow?.check_in_geofence_name
                  ) || "—"}
                </div>

                <div className="mt-2 text-xs text-muted-foreground">Jarak</div>
                <div className="mt-1 text-sm">
                  {selectedDayRow?.check_in_distance_to_fence_m != null
                    ? `${selectedDayRow.check_in_distance_to_fence_m.toFixed(1)} m`
                    : "—"}
                </div>
              </div>

              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Check Out</div>
                <div className="mt-1 text-sm font-medium">{fmtClock(selectedDayRow?.check_out_at, tz) || "—"}</div>

                {selectedDayRow?.is_early_out ? (
                  <div className="mt-1 text-xs text-rose-700">
                    Pulang Cepat{selectedDayRow?.early_out_minutes ? ` • ${selectedDayRow.early_out_minutes} menit lebih awal` : ""}
                  </div>
                ) : null}

                <div className="mt-2 text-xs text-muted-foreground">Geofence / Status</div>
                <div className="mt-1 text-sm">
                  {statusOrFence(
                    selectedDayRow?.check_out_attendance_leave_type,
                    selectedDayRow?.check_out_attendance_leave_notes,
                    selectedDayRow?.check_out_geofence_name
                  ) || "—"}
                </div>

                <div className="mt-2 text-xs text-muted-foreground">Jarak</div>
                <div className="mt-1 text-sm">
                  {selectedDayRow?.check_out_distance_to_fence_m != null
                    ? `${selectedDayRow.check_out_distance_to_fence_m.toFixed(1)} m`
                    : "—"}
                </div>
              </div>
            </div>

            {selectedDayRow ? (
              <div className="rounded-md border p-3">
                <div className="text-xs text-muted-foreground">Device</div>
                {(() => {
                  const dev = pickDevice(selectedDayRow)
                  return (
                    <div className="mt-2 space-y-1 text-sm">
                      <div>
                        <span className="text-muted-foreground">ID:</span> {dev.device_id || "—"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Name:</span> {dev.device_name || "—"}
                      </div>
                      <div>
                        <span className="text-muted-foreground">Model:</span> {dev.device_model || "—"}
                      </div>
                    </div>
                  )
                })()}
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => openSelfie(`Selfie Check In - ${dayYmd}`, selectedDayRow?.check_in_selfie_object_key)}
                disabled={!selectedDayRow?.check_in_selfie_object_key}
              >
                Selfie In
              </Button>
              <Button
                variant="outline"
                onClick={() => openSelfie(`Selfie Check Out - ${dayYmd}`, selectedDayRow?.check_out_selfie_object_key)}
                disabled={!selectedDayRow?.check_out_selfie_object_key}
              >
                Selfie Out
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
