const urlCache = new Map<string, string>()

export function cacheKeyOf(objectKey: string, nonce?: number | string) {
  return nonce === undefined ? objectKey : `${objectKey}::${nonce}`
}

export function getCachedAvatarUrl(cacheKey: string) {
  return urlCache.get(cacheKey)
}

export function storeCachedAvatarUrl(cacheKey: string, blobUrl: string) {
  urlCache.set(cacheKey, blobUrl)
}

export function invalidateAuthedAvatar(objectKey: string) {
  for (const [key, url] of urlCache.entries()) {
    if (key === objectKey || key.startsWith(objectKey + "::")) {
      try {
        URL.revokeObjectURL(url)
      } catch {
        // ignore
      }
      urlCache.delete(key)
    }
  }

  window.dispatchEvent(
    new CustomEvent("avatar:invalidate", { detail: { objectKey } })
  )
}
