import {QueryCache, MutationCache, QueryClient, QueryClientProvider} from "@tanstack/react-query"
import {Toaster} from "sonner"
import {toast} from "sonner"
import {apiErrorMessage} from "@/lib/api-error"
import React from "react";
import {ThemeProvider} from "@/components/theme-provider";

const queryClient = new QueryClient({
    queryCache: new QueryCache({
        onError: (err, query) => {
            // ⚠️ Query error kadang terlalu berisik (misal background refetch).
            // Kita hanya toast kalau query explicitly ingin.
            const meta = query.meta as { toastOnError?: boolean; errorTitle?: string } | undefined
            if (meta?.toastOnError) {
                toast.error(apiErrorMessage(err, {title: meta.errorTitle ?? "Gagal memuat data"}))
            }
        },
    }),
    mutationCache: new MutationCache({
        onError: (err, _variables, _ctx, mutation) => {
            // default: semua mutation error di-toast
            const meta = mutation.meta as { errorTitle?: string; fallbackMessage?: string } | undefined
            toast.error(apiErrorMessage(err, {
                title: meta?.errorTitle ?? "Gagal",
                fallbackMessage: meta?.fallbackMessage
            }))
        },
    }),
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
        mutations: {
            retry: 0,
        },
    },
})

export default function Providers({children}: { children: React.ReactNode }) {
    return (
        <ThemeProvider>
            <QueryClientProvider client={queryClient}>
                {children}
                <Toaster richColors position="top-right"/>
            </QueryClientProvider>
        </ThemeProvider>
    )
}
