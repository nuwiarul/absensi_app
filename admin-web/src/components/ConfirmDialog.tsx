import * as React from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type ConfirmDialogProps = {
    trigger: React.ReactNode
    title: string
    description?: React.ReactNode
    confirmText?: string
    cancelText?: string
    destructive?: boolean
    disabled?: boolean
    loading?: boolean
    onConfirm: () => void
}

export function ConfirmDialog({
                                  trigger,
                                  title,
                                  description,
                                  confirmText = "Ya, lanjut",
                                  cancelText = "Batal",
                                  destructive = false,
                                  disabled = false,
                                  loading = false,
                                  onConfirm,
                              }: ConfirmDialogProps) {
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild disabled={disabled || loading}>
                {trigger}
            </AlertDialogTrigger>

            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    {description ? (
                        <AlertDialogDescription>{description}</AlertDialogDescription>
                    ) : null}
                </AlertDialogHeader>

                <AlertDialogFooter>
                    <AlertDialogCancel disabled={loading}>{cancelText}</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={onConfirm}
                        disabled={loading}
                        className={
                            destructive
                                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                : undefined
                        }
                    >
                        {loading ? "Memproses..." : confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
