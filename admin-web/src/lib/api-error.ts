import type { AxiosError } from "axios"

export type BackendErrorResponse = {
    status?: string
    message?: string
}

export type ApiErrorMeta = {
    title?: string
    fallbackMessage?: string
}

export function apiErrorMessage(err: unknown, meta?: ApiErrorMeta): string {
    const title = meta?.title?.trim()
    const fallback = meta?.fallbackMessage ?? "Terjadi kesalahan"

    if (isAxiosError(err)) {
        const data = err.response?.data as BackendErrorResponse | undefined
        const msg = typeof data?.message === "string" ? data.message.trim() : ""
        if (msg) return title ? `${title}: ${msg}` : msg

        const st = typeof data?.status === "string" ? data.status.trim() : ""
        if (st) return title ? `${title}: ${st}` : st

        const http = err.response?.status
        if (http) return title ? `${title}: HTTP ${http}` : `HTTP ${http}`

        if (err.message) return title ? `${title}: ${err.message}` : err.message
    }

    if (err instanceof Error && err.message) {
        return title ? `${title}: ${err.message}` : err.message
    }

    return title ? `${title}: ${fallback}` : fallback
}

export function isAxiosError(err: unknown): err is AxiosError {
    return typeof err === "object" && err !== null && "isAxiosError" in err
}
