import * as React from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => setMounted(true), [])

  // Hindari mismatch / resolvedTheme undefined sebelum mount
  if (!mounted) {
    return (
        <Button variant="outline" size="icon" aria-label="Toggle theme" disabled>
          <Sun className="h-4 w-4" />
        </Button>
    )
  }

  const current = theme === "system" ? resolvedTheme : theme
  const isDark = current === "dark"

  return (
      <Button
          variant="outline"
          size="icon"
          aria-label="Toggle theme"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          title={isDark ? "Light mode" : "Dark mode"}
      >
        {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
  )
}
