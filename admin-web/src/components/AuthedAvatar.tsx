import * as React from "react"

import { http } from "@/lib/http"
import { Avatar } from "@/components/Avatar"
import { cacheKeyOf, getCachedAvatarUrl, storeCachedAvatarUrl } from "@/lib/authed-avatar-cache"

type Props = {
  objectKey?: string | null
  nonce?: number | string
  alt?: string
  size?: number
  className?: string
}

export function AuthedAvatar({ objectKey, nonce, alt, size, className }: Props) {
  const [tick, setTick] = React.useState(0)

  React.useEffect(() => {
    const onInvalidate = (e: Event) => {
      const ce = e as CustomEvent
      const ok = ce?.detail?.objectKey
      if (objectKey && ok === objectKey) {
        setTick((t) => t + 1)
      }
    }
    window.addEventListener("avatar:invalidate", onInvalidate)
    return () => window.removeEventListener("avatar:invalidate", onInvalidate)
  }, [objectKey])

  const [url, setUrl] = React.useState<string | null>(() => {
    if (!objectKey) return null
    const ck = cacheKeyOf(objectKey, nonce)
    return getCachedAvatarUrl(ck) ?? null
  })

  React.useEffect(() => {
    let alive = true

    ;(async () => {
      try {
        if (!objectKey) {
          if (alive) setUrl(null)
          return
        }

      const ck = cacheKeyOf(objectKey, nonce)
      const cached = getCachedAvatarUrl(ck)
      if (cached) {
        if (alive) setUrl(cached)
        return
      }

        const res = await http.get<Blob>("/files/profile", {
          params: { key: objectKey },
          responseType: "blob",
        })
        const blobUrl = URL.createObjectURL(res.data)
        storeCachedAvatarUrl(ck, blobUrl)
        if (alive) setUrl(blobUrl)
      } catch {
        if (alive) setUrl(null)
      }
    })()

    return () => {
      alive = false
    }
  }, [objectKey, nonce, tick])

  return <Avatar src={url} alt={alt} size={size} className={className} />
}
