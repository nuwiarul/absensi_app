import type { ReactNode } from "react"
import { ConfirmDialog } from "@/components/ConfirmDialog"

export default function DeleteConfirmDialog(props: {
  title?: string
  description: ReactNode
  loading?: boolean
  disabled?: boolean
  onConfirm: () => void
  trigger: ReactNode
  confirmText?: string
}) {
  const {
    title = "Hapus data?",
    description,
    loading,
    disabled,
    onConfirm,
    trigger,
    confirmText = "Ya, Hapus",
  } = props

  return (
    <ConfirmDialog
      title={title}
      description={description}
      destructive
      loading={loading}
      disabled={disabled}
      confirmText={confirmText}
      onConfirm={onConfirm}
      trigger={trigger}
    />
  )
}
