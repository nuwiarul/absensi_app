import * as React from "react"

import { getSession } from "@/lib/auth"
import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useUsers } from "@/features/users/hooks"
import type { User } from "@/features/users/types"

import {
  useCreateDutySchedule,
  useDeleteDutySchedule,
  useDutySchedules,
  useUpdateDutySchedule,
} from "@/features/duty-schedules/hooks"
import type { DutyScheduleDto, ScheduleType } from "@/features/duty-schedules/types"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog"

function ymd(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function addDays(d: Date, days: number) {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

function defaultRange(now: Date) {
  const from = startOfMonth(now)
  const toInclusive = endOfMonth(now)
  return { from: ymd(from), to: ymd(toInclusive) }
}

function toIsoStartOfDayLocal(ymdStr: string) {
  return new Date(`${ymdStr}T00:00:00`).toISOString()
}

function toIsoExclusiveEndDateLocal(ymdStrInclusive: string) {
  const d = new Date(`${ymdStrInclusive}T00:00:00`)
  const next = addDays(d, 1)
  return next.toISOString()
}

function fmtDateTimeId(iso?: string) {
  if (!iso) return "-"
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d)
  } catch {
    return iso
  }
}

function scheduleTypeLabel(t: ScheduleType) {
  switch (t) {
    case "REGULAR":
      return "Regular"
    case "SHIFT":
      return "Shift"
    case "ON_CALL":
      return "On Call"
    case "SPECIAL":
      return "Khusus"
    default:
      return t
  }
}

function isoToDatetimeLocalValue(iso?: string) {
  if (!iso) return ""
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function UserSelect({
  value,
  onChange,
  users,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  users: User[]
  disabled?: boolean
}) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Pilih user" />
      </SelectTrigger>
      <SelectContent>
        {users.map((u) => (
          <SelectItem key={u.id} value={u.id}>
            {u.full_name} • {u.nrp}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type FormMode = "create" | "edit"

function DutyScheduleFormDialog({
  open,
  onOpenChange,
  mode,
  row,
  users,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: FormMode
  row: DutyScheduleDto | null
  users: User[]
  onSubmit: (payload: {
    user_id: string
    start_at: string
    end_at: string
    schedule_type: ScheduleType
    title?: string
    note?: string
  }) => void
  loading?: boolean
}) {
  const [userId, setUserId] = React.useState<string>("")
  const [startLocal, setStartLocal] = React.useState<string>("")
  const [endLocal, setEndLocal] = React.useState<string>("")
  const [scheduleType, setScheduleType] = React.useState<ScheduleType>("SPECIAL")
  const [title, setTitle] = React.useState<string>("")
  const [note, setNote] = React.useState<string>("")

  React.useEffect(() => {
    if (!open) return
    if (mode === "edit" && row) {
      setUserId(row.user_id)
      setStartLocal(isoToDatetimeLocalValue(row.start_at))
      setEndLocal(isoToDatetimeLocalValue(row.end_at))
      setScheduleType(row.schedule_type)
      setTitle(row.title ?? "")
      setNote(row.note ?? "")
    } else {
      setUserId("")
      setStartLocal("")
      setEndLocal("")
      setScheduleType("SPECIAL")
      setTitle("")
      setNote("")
    }
  }, [open, mode, row])

  const canSubmit = React.useMemo(() => {
    if (!userId || !startLocal || !endLocal) return false
    const s = new Date(startLocal).getTime()
    const e = new Date(endLocal).getTime()
    return Number.isFinite(s) && Number.isFinite(e) && e > s
  }, [userId, startLocal, endLocal])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Tambah Jadwal Dinas" : "Edit Jadwal Dinas"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>User</Label>
            <UserSelect value={userId} onChange={setUserId} users={users} disabled={loading} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Mulai</Label>
              <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} disabled={loading} />
            </div>
            <div className="space-y-2">
              <Label>Selesai</Label>
              <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} disabled={loading} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipe</Label>
            <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as ScheduleType)} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SPECIAL">Khusus</SelectItem>
                <SelectItem value="SHIFT">Shift</SelectItem>
                <SelectItem value="ON_CALL">On Call</SelectItem>
                <SelectItem value="REGULAR">Regular</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Judul (opsional)</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Contoh: Pengamanan, Patroli, Pos Pam" disabled={loading} />
          </div>

          <div className="space-y-2">
            <Label>Catatan (opsional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan tambahan..." disabled={loading} />
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Batal
            </Button>
            <Button
              onClick={() => {
                const payload = {
                  user_id: userId,
                  start_at: new Date(startLocal).toISOString(),
                  end_at: new Date(endLocal).toISOString(),
                  schedule_type: scheduleType,
                  title: title.trim() ? title.trim() : undefined,
                  note: note.trim() ? note.trim() : undefined,
                }
                onSubmit(payload)
              }}
              disabled={loading || !canSubmit}
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default function DutySchedulesPage() {
  const session = getSession()
  const role = session?.role ?? "SUPERADMIN"
  const isSuper = role === "SUPERADMIN"
  const fixedSatkerId = session?.satkerId ?? ""

  const satkersQ = useSatkers()
  const satkers = satkersQ.data ?? []

  const now = new Date()
  const def = React.useMemo(() => defaultRange(now), [])

  const [fromYmd, setFromYmd] = React.useState(def.from)
  const [toYmd, setToYmd] = React.useState(def.to)

  const [satkerFilter, setSatkerFilter] = React.useState<string>("ALL")
  const effectiveSatkerId = isSuper ? (satkerFilter === "ALL" ? undefined : satkerFilter) : fixedSatkerId

  // For SUPERADMIN: don't load all users when Satker is still "ALL".
  const usersEnabled = !isSuper || satkerFilter !== "ALL"
  const usersQ = useUsers(effectiveSatkerId, usersEnabled)
  const users = (usersQ.data ?? []).filter((u) => u.is_active)

  const [userFilter, setUserFilter] = React.useState<string>("ALL")

  // Reset user filter when satker filter changes
  React.useEffect(() => {
    setUserFilter("ALL")
  }, [satkerFilter])

  const queryParams = React.useMemo(() => {
    const from = toIsoStartOfDayLocal(fromYmd)
    const to = toIsoExclusiveEndDateLocal(toYmd)
    return {
      from,
      to,
      satker_id: effectiveSatkerId,
      user_id: userFilter === "ALL" ? undefined : userFilter,
    }
  }, [fromYmd, toYmd, effectiveSatkerId, userFilter])

  const rowsQ = useDutySchedules(queryParams)
  const rows = rowsQ.data?.data ?? []

  const createM = useCreateDutySchedule()
  const updateM = useUpdateDutySchedule()
  const deleteM = useDeleteDutySchedule()

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [formMode, setFormMode] = React.useState<FormMode>("create")
  const [editing, setEditing] = React.useState<DutyScheduleDto | null>(null)

  const canManage = role === "SUPERADMIN" || role === "SATKER_ADMIN" || role === "SATKER_HEAD"

  const canCreateNow = canManage && (!isSuper || satkerFilter !== "ALL")

  return (
    <div className="p-4 space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Jadwal Dinas</CardTitle>
          {canManage ? (
            <Button
              onClick={() => {
                setFormMode("create")
                setEditing(null)
                setDialogOpen(true)
              }}
              disabled={!canCreateNow}
            >
              Tambah
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Dari</Label>
              <Input
                type="date"
                value={fromYmd}
                onChange={(e) => setFromYmd(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Sampai</Label>
              <Input
                type="date"
                value={toYmd}
                onChange={(e) => setToYmd(e.target.value)}
              />
            </div>

            {isSuper ? (
              <div className="space-y-2">
                <Label>Satker</Label>
                <SatkerSelect
                  value={satkerFilter}
                  onChange={setSatkerFilter}
                  items={satkers.filter((s) => s.is_active)}
                  placeholder={satkersQ.isLoading ? "Memuat..." : "Semua satker"}
                  allowAll
                  allLabel="Semua satker"
                  allValue="ALL"
                  disabled={satkersQ.isLoading}
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Satker</Label>
                <div className="text-sm text-muted-foreground pt-2">
                  {session?.satkerCode} - {session?.satkerName}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>User</Label>
              <Select
                value={userFilter}
                onValueChange={setUserFilter}
                disabled={usersQ.isLoading || !usersEnabled}
              >
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={
                      !usersEnabled
                        ? "Pilih satker dulu"
                        : usersQ.isLoading
                          ? "Memuat..."
                          : "Semua user"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {usersEnabled ? (
                    <>
                      <SelectItem value="ALL">Semua user</SelectItem>
                      {users.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.full_name} • {u.nrp}
                        </SelectItem>
                      ))}
                    </>
                  ) : (
                    <SelectItem value="ALL" disabled>
                      Pilih satker dulu
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left">Satker</th>
                  <th className="px-3 py-2 text-left">User</th>
                  <th className="px-3 py-2 text-left">Waktu</th>
                  <th className="px-3 py-2 text-left">Tipe</th>
                  <th className="px-3 py-2 text-left">Judul</th>
                  <th className="px-3 py-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rowsQ.isLoading ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                      Memuat...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td className="px-3 py-6 text-center text-muted-foreground" colSpan={6}>
                      Tidak ada jadwal dinas.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.satker_code}</div>
                        <div className="text-xs text-muted-foreground">{r.satker_name}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.user_full_name}</div>
                        <div className="text-xs text-muted-foreground">{r.user_nrp}{r.user_phone ? ` • ${r.user_phone}` : ""}</div>
                      </td>
                      <td className="px-3 py-2">
                        <div>{fmtDateTimeId(r.start_at)}</div>
                        <div className="text-xs text-muted-foreground">→ {fmtDateTimeId(r.end_at)}</div>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="outline">{scheduleTypeLabel(r.schedule_type)}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div>{r.title ?? "-"}</div>
                        {r.note ? <div className="text-xs text-muted-foreground">{r.note}</div> : null}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {canManage ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setFormMode("edit")
                                setEditing(r)
                                setDialogOpen(true)
                              }}
                            >
                              Edit
                            </Button>
                            <DeleteConfirmDialog
                              title="Hapus jadwal dinas?"
                              description={
                                <>
                                  Jadwal dinas <b>{r.user_full_name}</b> ({r.user_nrp}) akan dihapus.
                                </>
                              }
                              loading={deleteM.isPending}
                              disabled={createM.isPending || updateM.isPending}
                              confirmText="Ya, Hapus"
                              onConfirm={() => deleteM.mutate(r.id)}
                              trigger={
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={deleteM.isPending || createM.isPending || updateM.isPending}
                                >
                                  Hapus
                                </Button>
                              }
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <DutyScheduleFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={formMode}
        row={editing}
        users={users}
        loading={createM.isPending || updateM.isPending}
        onSubmit={(p) => {
          if (formMode === "create") {
            createM.mutate(p)
            setDialogOpen(false)
            return
          }
          if (!editing) return
          updateM.mutate({
            id: editing.id,
            payload: {
              start_at: p.start_at,
              end_at: p.end_at,
              schedule_type: p.schedule_type,
              title: p.title ?? null,
              note: p.note ?? null,
            },
          })
          setDialogOpen(false)
        }}
      />
    </div>
  )
}
