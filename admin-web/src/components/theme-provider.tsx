import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"

type Props = {
    children: React.ReactNode
}

export function ThemeProvider({ children }: Props) {
    return (
        <NextThemesProvider
            attribute="class"   // PENTING: cocok dengan .dark di CSS kamu
            defaultTheme="light"
            enableSystem
            disableTransitionOnChange
        >
            {children}
        </NextThemesProvider>
    )
}
