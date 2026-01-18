import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import DeleteConfirmDialog from "@/components/DeleteConfirmDialog"

import { useSatkers } from "@/features/satkers/hooks"
import type { Satker } from "@/features/satkers/types"
import { SatkerSelect } from "@/features/users/SatkerSelect"

import { useCreateGeofence, useDeleteGeofence, useGeofences, useUpdateGeofence } from "@/features/geofences/hooks"
import type { CreateGeofenceReq, Geofence, UpdateGeofenceReq } from "@/features/geofences/types"
import { getSession } from "@/lib/auth"

function GeofenceForm({
                        initial,
                        satkers,
                        canPickSatker,
                        fixedSatkerId,
                        onSubmit,
                        loading,
                      }: {
  initial?: {
    satkerId: string
    name: string
    latitude: number
    longitude: number
    radius_meters: number
  }
  satkers: Satker[]
  canPickSatker: boolean
  fixedSatkerId: string
  onSubmit: (v: { satkerId: string; body: CreateGeofenceReq }) => void
  loading: boolean
}) {
  const [satkerId, setSatkerId] = useState(initial?.satkerId ?? fixedSatkerId)
  const [name, setName] = useState(initial?.name ?? "")
  const [latitude, setLatitude] = useState(String(initial?.latitude ?? ""))
  const [longitude, setLongitude] = useState(String(initial?.longitude ?? ""))
  const [radius, setRadius] = useState(String(initial?.radius_meters ?? 100))

  const parsed = useMemo(() => {
    const lat = Number(latitude)
    const lng = Number(longitude)
    const rad = Number(radius)
    return {
      ok: Boolean(satkerId) && name.trim().length >= 3 && Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(rad),
      lat,
      lng,
      rad,
    }
  }, [latitude, longitude, name, radius, satkerId])

  return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Satker</Label>
          {canPickSatker ? (
              <SatkerSelect
                  value={satkerId}
                  onChange={setSatkerId}
                  items={satkers}
                  placeholder="Pilih satker"
                  disabled={loading}
              />
          ) : (
              <div className="text-sm text-muted-foreground">
                {(() => {
                  const s = satkers.find((x) => x.id === fixedSatkerId)
                  return s ? `${s.code} - ${s.name}` : "Satker"
                })()}
              </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Nama</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama geofence" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Latitude</Label>
            <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="-0.123456" />
          </div>
          <div className="space-y-2">
            <Label>Longitude</Label>
            <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="109.123456" />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Radius (meter)</Label>
          <Input value={radius} onChange={(e) => setRadius(e.target.value)} placeholder="100" />
        </div>

        <Button
            className="w-full"
            disabled={loading || !parsed.ok}
            onClick={() =>
                onSubmit({
                  satkerId,
                  body: {
                    name: name.trim(),
                    latitude: parsed.lat,
                    longitude: parsed.lng,
                    radius_meters: Math.trunc(parsed.rad),
                  },
                })
            }
        >
          {loading ? "Saving..." : "Simpan"}
        </Button>
      </div>
  )
}

export default function GeofencesPage() {
  const session = getSession()
  const isSuper = session?.role === "SUPERADMIN"
  const fixedSatkerId = session?.satkerId ?? ""

  const satkersQ = useSatkers()
  const geofencesQ = useGeofences()
  const createM = useCreateGeofence()
  const updateM = useUpdateGeofence()
  const deleteM = useDeleteGeofence()

  const [q, setQ] = useState("")
  // Filter satker untuk tabel (khusus SUPERADMIN). Hindari value kosong di Select.
  const [filterSatkerId, setFilterSatkerId] = useState<string>("ALL")
  const [openCreate, setOpenCreate] = useState(false)
  const [openEditId, setOpenEditId] = useState<string | null>(null)

  const satkers = satkersQ.data ?? []
  const rows = geofencesQ.data ?? []

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const bySatker = (g: Geofence) => {
      if (!isSuper) return true
      if (filterSatkerId === "ALL") return true
      return g.satker.id === filterSatkerId
    }

    const base = rows.filter(bySatker)
    if (!s) return base
    return base.filter((g) => {
      const satkerLabel = `${g.satker.code} ${g.satker.name}`.toLowerCase()
      return (
          g.name.toLowerCase().includes(s) ||
          satkerLabel.includes(s) ||
          String(g.latitude).includes(s) ||
          String(g.longitude).includes(s)
      )
    })
  }, [filterSatkerId, isSuper, q, rows])

  return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Geofence</CardTitle>

          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <Button onClick={() => setOpenCreate(true)}>+ Tambah Geofence</Button>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Buat Geofence</DialogTitle>
              </DialogHeader>
              <GeofenceForm
                  satkers={satkers}
                  canPickSatker={isSuper}
                  fixedSatkerId={fixedSatkerId}
                  loading={createM.isPending}
                  onSubmit={async ({ satkerId, body }) => {
                    await createM.mutateAsync({ satkerId: isSuper ? satkerId : fixedSatkerId, body })
                    setOpenCreate(false)
                  }}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent className="space-y-4">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari geofence (nama/satker/koordinat)..." />

          {isSuper && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="w-full sm:w-72">
                  <Label>Filter satker</Label>
                  <SatkerSelect
                      value={filterSatkerId}
                      onChange={setFilterSatkerId}
                      items={satkers.filter((x) => x.is_active)}
                      placeholder={satkersQ.isLoading ? "Memuat..." : "Pilih satker"}
                      allowAll
                      allLabel="Semua satker"
                      allValue="ALL"
                      disabled={satkersQ.isLoading}
                  />
                </div>
              </div>
          )}

          {geofencesQ.isLoading || satkersQ.isLoading ? (
              <div>Loading...</div>
          ) : geofencesQ.isError || satkersQ.isError ? (
              <div className="text-red-600">Gagal load geofence</div>
          ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama</TableHead>
                    <TableHead>Satker</TableHead>
                    <TableHead>Latitude</TableHead>
                    <TableHead>Longitude</TableHead>
                    <TableHead>Radius</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((g: Geofence) => (
                      <TableRow key={g.id}>
                        <TableCell className="font-medium">{g.name}</TableCell>
                        <TableCell>{g.satker.code} - {g.satker.name}</TableCell>
                        <TableCell>{g.latitude}</TableCell>
                        <TableCell>{g.longitude}</TableCell>
                        <TableCell>{g.radius_meters} m</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Dialog
                              open={openEditId === g.id}
                              onOpenChange={(open) => {
                                if (updateM.isPending) return
                                if (!open) setOpenEditId(null)
                              }}
                          >
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={updateM.isPending || deleteM.isPending || createM.isPending}
                                onClick={() => setOpenEditId(g.id)}
                            >
                              Edit
                            </Button>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Geofence</DialogTitle>
                              </DialogHeader>
                              <GeofenceForm
                                  initial={{
                                    satkerId: g.satker.id,
                                    name: g.name,
                                    latitude: g.latitude,
                                    longitude: g.longitude,
                                    radius_meters: g.radius_meters,
                                  }}
                                  satkers={satkers}
                                  canPickSatker={false /* edit tidak boleh pindah satker */}
                                  fixedSatkerId={g.satker.id}
                                  loading={updateM.isPending}
                                  onSubmit={async ({ body }) => {
                                    const upd: UpdateGeofenceReq = {
                                      name: body.name,
                                      latitude: body.latitude,
                                      longitude: body.longitude,
                                      radius_meters: body.radius_meters,
                                    }
                                    await updateM.mutateAsync({ id: g.id, body: upd })
                                    setOpenEditId(null)
                                  }}
                              />
                            </DialogContent>
                          </Dialog>

                          <DeleteConfirmDialog
                              title="Hapus geofence?"
                              description={
                                <>
                                  Geofence <b>{g.name}</b> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
                                </>
                              }
                              loading={deleteM.isPending}
                              disabled={updateM.isPending || createM.isPending}
                              confirmText="Ya, Hapus"
                              onConfirm={() => deleteM.mutate(g.id)}
                              trigger={
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    disabled={deleteM.isPending || updateM.isPending || createM.isPending}
                                >
                                  Hapus
                                </Button>
                              }
                          />
                        </TableCell>
                      </TableRow>
                  ))}
                  {filtered.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground">
                          Tidak ada data
                        </TableCell>
                      </TableRow>
                  )}
                </TableBody>
              </Table>
          )}
        </CardContent>
      </Card>
  )
}
