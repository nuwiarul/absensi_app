import * as React from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useSatkers } from "@/features/satkers/hooks"
import { useRanks } from "@/features/ranks/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useCreateUser, useUpdateUser } from "@/features/users/hooks"
import type { User, UserRole, UpdateUserReq } from "@/features/users/types"
import {apiErrorMessage} from "@/lib/api-error.ts";
import { getSession } from "@/lib/auth"

/* =======================
   ZOD SCHEMA
======================= */

const formSchema = z
    .object({
      satker_id: z.string().min(4, "satker di butuhkan"),
      rank_id: z.string().nullable().optional(),
      nrp: z.string().min(4, "nrp di butuhkan"),
      full_name: z.string().min(1, "full_name di butuhkan"),
      email: z.string().min(4, "email di butuhkan").email("email invalid"),
      phone: z.string().nullable().optional(),

      // create-only
      role: z.enum(["SATKER_ADMIN", "SATKER_HEAD", "MEMBER"]).optional(),
      password: z.string().min(8).max(64).optional(),
      password_confirm: z.string().min(8).max(64).optional(),
    })
    .refine(
        (v) => {
          if (!v.password && !v.password_confirm) return true
          return v.password === v.password_confirm
        },
        {
          message: "password tidak sama",
          path: ["password_confirm"],
        }
    )

type FormValues = z.infer<typeof formSchema>

type Mode = "create" | "edit"

type Props = {
  mode: Mode
  open: boolean
  onOpenChange: (v: boolean) => void
  user?: User
}

/* =======================
   ROLE SELECT
======================= */

function RoleSelect(props: {
  value?: UserRole
  onChange: (v: UserRole) => void
  disabled?: boolean
  allowed: UserRole[]
}) {
  const roles: UserRole[] = props.allowed

  return (
      <Select
          value={props.value}
          onValueChange={(v) => props.onChange(v as UserRole)}
          disabled={props.disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Pilih role" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
          ))}
        </SelectContent>
      </Select>
  )
}

/* =======================
   MAIN DIALOG
======================= */

export function UserFormDialog({ mode, open, onOpenChange, user }: Props) {
  const isEdit = mode === "edit"
  // getSession() biasanya parse dari storage, bisa menghasilkan object baru tiap render.
  // Jadi jangan pakai `session` sebagai dependency useEffect agar tidak memicu loop update.
  const session = getSession()
  const sessionRole = session?.role
  const sessionSatkerId = session?.satkerId ?? ""
  const isSuper = sessionRole === "SUPERADMIN"

  const createMut = useCreateUser()
  const updateMut = useUpdateUser()
  const { data: satkers = [], isLoading: satkerLoading } = useSatkers()
  const { data: ranks = [], isLoading: ranksLoading } = useRanks()

  const busy = createMut.isPending || updateMut.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      satker_id: "",
      rank_id: null,
      nrp: "",
      full_name: "",
      email: "",
      phone: "",
      role: "MEMBER",
      password: "",
      password_confirm: "",
    },
  })

  /* reset ketika open / ganti user */
  React.useEffect(() => {
    if (!open) return

    if (isEdit && user) {
      form.reset({
        satker_id: user.satker.id,
        rank_id: user.rank_id ?? null,
        nrp: user.nrp,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone ?? "",
      })
    } else {
      form.reset({
        satker_id: !isSuper ? sessionSatkerId : "",
        rank_id: null,
        nrp: "",
        full_name: "",
        email: "",
        phone: "",
        role: "MEMBER",
        password: "",
        password_confirm: "",
      })
    }
  }, [open, isEdit, user, form, isSuper, sessionSatkerId])

  // For SATKER_ADMIN: force satker_id
  React.useEffect(() => {
    if (!open) return
    if (!isSuper && sessionSatkerId) {
      const current = form.getValues("satker_id")
      if (current !== sessionSatkerId) {
        form.setValue("satker_id", sessionSatkerId, { shouldValidate: true })
      }
    }
  }, [open, isSuper, sessionSatkerId, form])

  /* =======================
     SUBMIT
  ======================= */

  const submit = async (values: FormValues) => {
    try {
      if (!isEdit) {
        await createMut.mutateAsync({
          satker_id: values.satker_id,
          rank_id: values.rank_id ?? null,
          nrp: values.nrp,
          full_name: values.full_name,
          email: values.email,
          phone: values.phone ?? null,
          role: values.role,
          password: values.password!,
          password_confirm: values.password_confirm!,
        })
        onOpenChange(false)
        return
      }

      if (!user) return toast.error("User tidak ditemukan")

      const payload: UpdateUserReq = {
        satker_id: values.satker_id,
        rank_id: values.rank_id ?? null,
        nrp: values.nrp,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone ?? null,
      }

      await updateMut.mutateAsync({ id: user.id, payload })
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e))
    }
  }

  /* =======================
     RENDER
  ======================= */

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit User" : "Tambah User"}</DialogTitle>
            <DialogDescription>
              {isEdit
                  ? "Ubah data user. Role tidak dapat diubah saat update."
                  : "Buat user baru untuk satker."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            {/* SATKER */}
            <div className="space-y-1">
              <Label>Satker</Label>
              <Controller
                  control={form.control}
                  name="satker_id"
                  render={({ field }) => (
                      <SatkerSelect
                          value={field.value}
                          onChange={field.onChange}
                          items={satkers.filter((s) => s.is_active)}
                          disabled={satkerLoading || busy || !isSuper}
                      />
                  )}
              />
              <p className="text-xs text-red-600">
                {form.formState.errors.satker_id?.message}
              </p>
            </div>

            {/* RANK */}
            <div className="space-y-1">
              <Label>Pangkat / Golongan (opsional)</Label>
              <Controller
                  control={form.control}
                  name="rank_id"
                  render={({ field }) => (
                      <Select
                          value={field.value ?? "NONE"}
                          onValueChange={(v) => field.onChange(v === "NONE" ? null : v)}
                          disabled={busy || ranksLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={ranksLoading ? "Memuat..." : "Pilih pangkat/golongan"} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">(Kosong)</SelectItem>
                          {ranks.map((r) => (
                              <SelectItem key={r.id} value={r.id}>
                                {r.code} - {r.name}
                              </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                  )}
              />
            </div>

            <div className="space-y-1">
              <Label>NRP</Label>
              <Input {...form.register("nrp")} disabled={busy} />
              <p className="text-xs text-red-600">{form.formState.errors.nrp?.message}</p>
            </div>

            <div className="space-y-1">
              <Label>Nama Lengkap</Label>
              <Input {...form.register("full_name")} disabled={busy} />
              <p className="text-xs text-red-600">{form.formState.errors.full_name?.message}</p>
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...form.register("email")} disabled={busy} />
              <p className="text-xs text-red-600">{form.formState.errors.email?.message}</p>
            </div>

            <div className="space-y-1">
              <Label>Telepon (opsional)</Label>
              <Input {...form.register("phone")} disabled={busy} />
            </div>

            {!isEdit && (
                <>
                  <div className="space-y-1">
                    <Label>Role</Label>
                    <Controller
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <RoleSelect
                                value={field.value}
                                onChange={field.onChange}
                                disabled={busy}
                                allowed={isSuper ? ["SATKER_ADMIN", "SATKER_HEAD", "MEMBER"] : ["SATKER_HEAD", "MEMBER"]}
                            />
                        )}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Password</Label>
                    <Input type="password" {...form.register("password")} disabled={busy} />
                  </div>

                  <div className="space-y-1">
                    <Label>Konfirmasi Password</Label>
                    <Input type="password" {...form.register("password_confirm")} disabled={busy} />
                    <p className="text-xs text-red-600">
                      {form.formState.errors.password_confirm?.message}
                    </p>
                  </div>
                </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  )
}



/*
import * as React from "react"
import { z } from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { useSatkers } from "@/features/satkers/hooks"
import { SatkerSelect } from "@/features/users/SatkerSelect"
import { useCreateUser, useUpdateUser } from "@/features/users/hooks"
import type { User, UserRole, UpdateUserReq } from "@/features/users/types"
import {apiErrorMessage} from "@/lib/api-error.ts";
import { getSession } from "@/lib/auth"

/!* =======================
   ZOD SCHEMA
======================= *!/

const formSchema = z
    .object({
      satker_id: z.string().min(4, "satker di butuhkan"),
      nrp: z.string().min(4, "nrp di butuhkan"),
      full_name: z.string().min(1, "full_name di butuhkan"),
      email: z.string().min(4, "email di butuhkan").email("email invalid"),
      phone: z.string().nullable().optional(),

      // create-only
      role: z.enum(["SATKER_ADMIN", "SATKER_HEAD", "MEMBER"]).optional(),
      password: z.string().min(8).max(64).optional(),
      password_confirm: z.string().min(8).max(64).optional(),
    })
    .refine(
        (v) => {
          if (!v.password && !v.password_confirm) return true
          return v.password === v.password_confirm
        },
        {
          message: "password tidak sama",
          path: ["password_confirm"],
        }
    )

type FormValues = z.infer<typeof formSchema>

type Mode = "create" | "edit"

type Props = {
  mode: Mode
  open: boolean
  onOpenChange: (v: boolean) => void
  user?: User
}

/!* =======================
   ROLE SELECT
======================= *!/

function RoleSelect(props: {
  value?: UserRole
  onChange: (v: UserRole) => void
  disabled?: boolean
  allowed: UserRole[]
}) {
  const roles: UserRole[] = props.allowed

  return (
      <Select
          value={props.value}
          onValueChange={(v) => props.onChange(v as UserRole)}
          disabled={props.disabled}
      >
        <SelectTrigger>
          <SelectValue placeholder="Pilih role" />
        </SelectTrigger>
        <SelectContent>
          {roles.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
          ))}
        </SelectContent>
      </Select>
  )
}

/!* =======================
   MAIN DIALOG
======================= *!/

export function UserFormDialog({ mode, open, onOpenChange, user }: Props) {
  const isEdit = mode === "edit"
  // getSession() biasanya parse dari storage, bisa menghasilkan object baru tiap render.
  // Jadi jangan pakai `session` sebagai dependency useEffect agar tidak memicu loop update.
  const session = getSession()
  const sessionRole = session?.role
  const sessionSatkerId = session?.satkerId ?? ""
  const isSuper = sessionRole === "SUPERADMIN"

  const createMut = useCreateUser()
  const updateMut = useUpdateUser()
  const { data: satkers = [], isLoading: satkerLoading } = useSatkers()

  const busy = createMut.isPending || updateMut.isPending

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      satker_id: "",
      nrp: "",
      full_name: "",
      email: "",
      phone: "",
      role: "MEMBER",
      password: "",
      password_confirm: "",
    },
  })

  /!* reset ketika open / ganti user *!/
  React.useEffect(() => {
    if (!open) return

    if (isEdit && user) {
      form.reset({
        satker_id: user.satker.id,
        nrp: user.nrp,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone ?? "",
      })
    } else {
      form.reset({
        satker_id: !isSuper ? sessionSatkerId : "",
        nrp: "",
        full_name: "",
        email: "",
        phone: "",
        role: "MEMBER",
        password: "",
        password_confirm: "",
      })
    }
  }, [open, isEdit, user, form, isSuper, sessionSatkerId])

  // For SATKER_ADMIN: force satker_id
  React.useEffect(() => {
    if (!open) return
    if (!isSuper && sessionSatkerId) {
      const current = form.getValues("satker_id")
      if (current !== sessionSatkerId) {
        form.setValue("satker_id", sessionSatkerId, { shouldValidate: true })
      }
    }
  }, [open, isSuper, sessionSatkerId, form])

  /!* =======================
     SUBMIT
  ======================= *!/

  const submit = async (values: FormValues) => {
    try {
      if (!isEdit) {
        await createMut.mutateAsync({
          satker_id: values.satker_id,
          nrp: values.nrp,
          full_name: values.full_name,
          email: values.email,
          phone: values.phone ?? null,
          role: values.role,
          password: values.password!,
          password_confirm: values.password_confirm!,
        })
        onOpenChange(false)
        return
      }

      if (!user) return toast.error("User tidak ditemukan")

      const payload: UpdateUserReq = {
        satker_id: values.satker_id,
        nrp: values.nrp,
        full_name: values.full_name,
        email: values.email,
        phone: values.phone ?? null,
      }

      await updateMut.mutateAsync({ id: user.id, payload })
      onOpenChange(false)
    } catch (e: unknown) {
      toast.error(apiErrorMessage(e))
    }
  }

  /!* =======================
     RENDER
  ======================= *!/

  return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit User" : "Tambah User"}</DialogTitle>
            <DialogDescription>
              {isEdit
                  ? "Ubah data user. Role tidak dapat diubah saat update."
                  : "Buat user baru untuk satker."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
            {/!* SATKER *!/}
            <div className="space-y-1">
              <Label>Satker</Label>
              <Controller
                  control={form.control}
                  name="satker_id"
                  render={({ field }) => (
                      <SatkerSelect
                          value={field.value}
                          onChange={field.onChange}
                          items={satkers.filter((s) => s.is_active)}
                          disabled={satkerLoading || busy || !isSuper}
                      />
                  )}
              />
              <p className="text-xs text-red-600">
                {form.formState.errors.satker_id?.message}
              </p>
            </div>

            <div className="space-y-1">
              <Label>NRP</Label>
              <Input {...form.register("nrp")} disabled={busy} />
              <p className="text-xs text-red-600">{form.formState.errors.nrp?.message}</p>
            </div>

            <div className="space-y-1">
              <Label>Nama Lengkap</Label>
              <Input {...form.register("full_name")} disabled={busy} />
              <p className="text-xs text-red-600">{form.formState.errors.full_name?.message}</p>
            </div>

            <div className="space-y-1">
              <Label>Email</Label>
              <Input {...form.register("email")} disabled={busy} />
              <p className="text-xs text-red-600">{form.formState.errors.email?.message}</p>
            </div>

            <div className="space-y-1">
              <Label>Telepon (opsional)</Label>
              <Input {...form.register("phone")} disabled={busy} />
            </div>

            {!isEdit && (
                <>
                  <div className="space-y-1">
                    <Label>Role</Label>
                    <Controller
                        control={form.control}
                        name="role"
                        render={({ field }) => (
                            <RoleSelect
                                value={field.value}
                                onChange={field.onChange}
                                disabled={busy}
                                allowed={isSuper ? ["SATKER_ADMIN", "SATKER_HEAD", "MEMBER"] : ["SATKER_HEAD", "MEMBER"]}
                            />
                        )}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Password</Label>
                    <Input type="password" {...form.register("password")} disabled={busy} />
                  </div>

                  <div className="space-y-1">
                    <Label>Konfirmasi Password</Label>
                    <Input type="password" {...form.register("password_confirm")} disabled={busy} />
                    <p className="text-xs text-red-600">
                      {form.formState.errors.password_confirm?.message}
                    </p>
                  </div>
                </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
  )
}
*/
