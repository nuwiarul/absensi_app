import * as React from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { apiErrorMessage } from "@/lib/api-error"
import { getSession, setSession } from "@/lib/auth"

import { AuthedAvatar } from "@/components/AuthedAvatar"
import { invalidateAuthedAvatar } from "@/lib/authed-avatar-cache"
import { getMe, updateMyProfile, uploadMyPhoto } from "@/features/users/api"
import type { User } from "@/features/users/types"

export default function ProfilePage() {
  const session = getSession()

  const [me, setMe] = React.useState<User | null>(null)
  const [fullName, setFullName] = React.useState("")
  const [phone, setPhone] = React.useState<string>("")

  const [busyProfile, setBusyProfile] = React.useState(false)
  const [busyPhoto, setBusyPhoto] = React.useState(false)
  const [photoNonce, setPhotoNonce] = React.useState(0)

  const refreshMe = React.useCallback(async () => {
    const u = await getMe()
    setMe(u)
    setFullName(u.full_name ?? "")
    setPhone(u.phone ?? "")
  }, [])

  React.useEffect(() => {
    ;(async () => {
      try {
        await refreshMe()
      } catch (e) {
        toast.error(apiErrorMessage(e))
      }
    })()
  }, [refreshMe])

  const syncSessionName = (nextFullName: string) => {
    const s = getSession()
    if (!s) return
    setSession({ ...s, fullName: nextFullName })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Profil Saya</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Data Profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-4">
            <AuthedAvatar
              objectKey={me?.profile_photo_key ?? null}
              nonce={photoNonce}
              alt={me?.full_name ?? session?.fullName}
              size={80}
              className="rounded-xl"
            />

            <div className="space-y-2">
              <Label>Foto Profil</Label>
              <Input
                type="file"
                accept="image/png,image/jpeg"
                disabled={busyPhoto}
                onChange={async (e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  try {
                    setBusyPhoto(true)
                    const key = await uploadMyPhoto(f)
                    setMe((prev) => (prev ? { ...prev, profile_photo_key: key } : prev))
                    invalidateAuthedAvatar(key)
                    setPhotoNonce((n) => n + 1)
                    // notify header to refetch avatar
                    window.dispatchEvent(new Event("me:updated"))
                    toast.success("Foto profil disimpan")
                  } catch (err) {
                    toast.error(apiErrorMessage(err))
                  } finally {
                    setBusyPhoto(false)
                    e.currentTarget.value = ""
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">Maks 2MB, format JPG/PNG.</p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>Full name</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>

            <div className="space-y-1">
              <Label>No. HP</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="08xxxxxxxxxx" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              disabled={busyProfile}
              onClick={async () => {
                try {
                  setBusyProfile(true)
                  const msg = await updateMyProfile({ full_name: fullName, phone: phone || null })
                  syncSessionName(fullName)
                  window.dispatchEvent(new Event("me:updated"))
                  toast.success(msg || "Profil disimpan")
                  await refreshMe()
                } catch (e) {
                  toast.error(apiErrorMessage(e))
                } finally {
                  setBusyProfile(false)
                }
              }}
            >
              Simpan Profil
            </Button>
            <div className="text-sm text-muted-foreground">
              NRP: {me?.nrp ?? "-"} • Role: {me?.role ?? "-"}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
