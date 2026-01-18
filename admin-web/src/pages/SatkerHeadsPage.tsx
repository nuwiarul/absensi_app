import * as React from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { getSession } from "@/lib/auth"
import { apiErrorMessage } from "@/lib/api-error"

import { useSatkers } from "@/features/satkers/hooks"
import { useUsers } from "@/features/users/hooks"
import { useSatkerHeads, useSetSatkerHead } from "@/features/satker-head/hooks"

export default function SatkerHeadsPage() {
  const s = getSession()
  const isSuper = s?.role === "SUPERADMIN"

  const { data: satkers = [], isLoading: satkerLoading } = useSatkers()
  const { data: heads = [], isLoading, isError, error } = useSatkerHeads()
  const setMut = useSetSatkerHead()

  const [open, setOpen] = React.useState(false)
  const [satkerId, setSatkerId] = React.useState<string>("")
  const [userId, setUserId] = React.useState<string>("")

  // For SATKER_ADMIN: force to their satker
  React.useEffect(() => {
    if (!s) return
    if (!isSuper) {
      setSatkerId(s.satkerId)
    }
  }, [s, isSuper])

  const { data: users = [], isLoading: usersLoading } = useUsers(
    satkerId ? satkerId : undefined
  )

  const selectableUsers = React.useMemo(() => {
    // You can only set a head from members within the satker.
    // We allow MEMBER or SATKER_HEAD to be selected.
    return users.filter((u) => u.is_active)
  }, [users])

  React.useEffect(() => {
    if (isError && error) {
      toast.error(apiErrorMessage(error, { title: "Gagal memuat satker head" }))
    }
  }, [isError, error])

  const currentHeadsBySatker = React.useMemo(() => {
    const map = new Map<string, (typeof heads)[number]>()
    for (const h of heads) {
      // Prefer active (active_to null)
      const existing = map.get(h.satker_id)
      const isActive = !h.active_to
      if (!existing) {
        map.set(h.satker_id, h)
        continue
      }
      const existingActive = !existing.active_to
      if (isActive && !existingActive) map.set(h.satker_id, h)
    }
    return map
  }, [heads])

  const visibleSatkers = React.useMemo(() => {
    if (!s) return []
    if (isSuper) return satkers.filter((x) => x.is_active)
    return satkers.filter((x) => x.id === s.satkerId)
  }, [s, isSuper, satkers])

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Satker Head</CardTitle>
        <Button onClick={() => { setUserId(""); setOpen(true) }}>Set Satker Head</Button>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="relative w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Satker</TableHead>
                <TableHead>Head</TableHead>
                <TableHead>NRP</TableHead>
                <TableHead>Aktif dari</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || satkerLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Memuat...
                  </TableCell>
                </TableRow>
              ) : visibleSatkers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                    Tidak ada data
                  </TableCell>
                </TableRow>
              ) : (
                visibleSatkers.map((sk) => {
                  const head = currentHeadsBySatker.get(sk.id)
                  return (
                    <TableRow key={sk.id}>
                      <TableCell className="font-medium">{sk.code} - {sk.name}</TableCell>
                      <TableCell>{head ? head.full_name : "-"}</TableCell>
                      <TableCell>{head ? head.nrp : "-"}</TableCell>
                      <TableCell>{head ? head.active_from : "-"}</TableCell>
                      <TableCell>{head?.status ?? (head?.active_to ? "Nonaktif" : "Aktif")}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { if (!setMut.isPending) setOpen(v) }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Set Satker Head</DialogTitle>
            <DialogDescription>Pilih satker dan user yang akan dijadikan head satker.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Satker</Label>
              <Select
                value={satkerId}
                onValueChange={(v) => { setSatkerId(v); setUserId("") }}
                disabled={!isSuper || setMut.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={satkerLoading ? "Memuat..." : "Pilih satker"} />
                </SelectTrigger>
                <SelectContent>
                  {visibleSatkers.map((sk) => (
                    <SelectItem key={sk.id} value={sk.id}>
                      {sk.code} - {sk.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>User (anggota satker)</Label>
              <Select
                value={userId}
                onValueChange={setUserId}
                disabled={!satkerId || usersLoading || setMut.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder={usersLoading ? "Memuat user..." : "Pilih user"} />
                </SelectTrigger>
                <SelectContent>
                  {selectableUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name} ({u.nrp})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={setMut.isPending}>
              Batal
            </Button>
            <Button
              type="button"
              disabled={!satkerId || !userId || setMut.isPending}
              onClick={async () => {
                await setMut.mutateAsync({ satkerId, userId })
                setOpen(false)
              }}
            >
              {setMut.isPending ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
