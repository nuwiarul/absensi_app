import * as React from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

import type { User } from "@/features/users/types"
import { apiErrorMessage } from "@/lib/api-error"
import { getSession } from "@/lib/auth"
import { adminSetPassword, adminUploadPhoto } from "@/features/users/api"
import { usersKeys } from "@/features/users/hooks"
import { invalidateAuthedAvatar } from "@/components/AuthedAvatar"

const pwSchema = z
  .object({
    password: z.string().min(8).max(64),
    password_confirm: z.string().min(8).max(64),
  })
  .refine((v) => v.password === v.password_confirm, {
    message: "password tidak sama",
    path: ["password_confirm"],
  })

type PwForm = z.infer<typeof pwSchema>

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  user: User | null
  mode: "password" | "photo"
}

export function UserSecurityDialog({ open, onOpenChange, user, mode }: Props) {
  const qc = useQueryClient()
  const [busy, setBusy] = React.useState(false)
  const [photo, setPhoto] = React.useState<File | null>(null)
  //const qc = useQueryClient()

  const form = useForm<PwForm>({
    resolver: zodResolver(pwSchema),
    defaultValues: { password: "", password_confirm: "" },
  })

  React.useEffect(() => {
    if (!open) return
    form.reset({ password: "", password_confirm: "" })
    setPhoto(null)
  }, [open, form])

  if (!user) return null

  const submitPassword = async (v: PwForm) => {
    try {
      setBusy(true)
      const msg = await adminSetPassword(user.id, v)
      toast.success(msg || "Password diubah")
      form.reset({ password: "", password_confirm: "" })
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const submitPhoto = async () => {
    if (!photo) return toast.error("Pilih file dulu")
    try {
      setBusy(true)
      const key = await adminUploadPhoto(user.id, photo)
      toast.success("Foto profile diupdate")
      // Ensure list + avatars update instantly (even if objectKey stays the same)
      if (key) invalidateAuthedAvatar(key)
      qc.invalidateQueries({ queryKey: usersKeys.all })

      // If admin changed their own photo, refresh header avatar too
      // (this will refetch /me + bust avatar cache via nonce)
      const s = getSession()
      if (s && user.id === s.userId) {
        window.dispatchEvent(new Event("me:updated"))
      }
      setPhoto(null)
      return key
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "password" ? "Ganti Password User" : "Ganti Foto User"}
          </DialogTitle>
          <DialogDescription>
            {mode === "password"
              ? "Reset password untuk"
              : "Ubah foto profile untuk"}
            : <b>{user.full_name}</b> ({user.nrp})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {mode === "password" ? (
            <form className="space-y-3" onSubmit={form.handleSubmit(submitPassword)}>
              <div className="space-y-1">
                <Label>Password baru</Label>
                <Input type="password" {...form.register("password")} disabled={busy} />
                <p className="text-xs text-red-600">{form.formState.errors.password?.message}</p>
              </div>
              <div className="space-y-1">
                <Label>Konfirmasi password</Label>
                <Input type="password" {...form.register("password_confirm")} disabled={busy} />
                <p className="text-xs text-red-600">{form.formState.errors.password_confirm?.message}</p>
              </div>

              <DialogFooter>
                <Button type="submit" disabled={busy}>
                  Simpan password
                </Button>
              </DialogFooter>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Foto profile</Label>
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  disabled={busy}
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">Maks 2MB (jpg/png)</p>
              </div>
              <Button variant="outline" onClick={submitPhoto} disabled={busy || !photo}>
                Upload foto
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
