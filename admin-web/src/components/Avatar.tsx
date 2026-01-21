import { cn } from "@/lib/utils"

// Default avatar as inline SVG (data-uri) to avoid adding binary assets.
const DEFAULT_AVATAR_DATA_URI =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='64' fill='%23262a33'/%3E%3Ccircle cx='64' cy='52' r='22' fill='%239aa4b2'/%3E%3Cpath d='M24 116c8-22 24-34 40-34s32 12 40 34' fill='%239aa4b2'/%3E%3C/svg%3E"

type Props = {
  src?: string | null
  alt?: string
  size?: number
  className?: string
}

export function Avatar({ src, alt, size = 32, className }: Props) {
  return (
    <img
      src={src || DEFAULT_AVATAR_DATA_URI}
      alt={alt || "avatar"}
      className={cn("rounded-full border object-cover", className)}
      style={{ width: size, height: size }}
      loading="lazy"
    />
  )
}
