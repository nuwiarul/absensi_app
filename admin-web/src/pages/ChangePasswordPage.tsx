import * as React from "react"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

import { apiErrorMessage } from "@/lib/api-error"
import { changeMyPassword } from "@/features/users/api"

export default function ChangePasswordPage() {
  const [busy, setBusy] = React.useState(false)
  const [oldPw, setOldPw] = React.useState("")
  const [newPw, setNewPw] = React.useState("")
  const [newPw2, setNewPw2] = React.useState("")

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Ganti Password</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Password</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>Password lama</Label>
              <Input type="password" value={oldPw} onChange={(e) => setOldPw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Password baru</Label>
              <Input type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Konfirmasi</Label>
              <Input type="password" value={newPw2} onChange={(e) => setNewPw2(e.target.value)} />
            </div>
          </div>

          <Button
            disabled={busy}
            onClick={async () => {
              try {
                setBusy(true)
                const msg = await changeMyPassword({
                  old_password: oldPw,
                  password: newPw,
                  password_confirm: newPw2,
                })
                toast.success(msg || "Password berhasil diubah")
                setOldPw("")
                setNewPw("")
                setNewPw2("")
              } catch (e) {
                toast.error(apiErrorMessage(e))
              } finally {
                setBusy(false)
              }
            }}
          >
            Ubah Password
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
