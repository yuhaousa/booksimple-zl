import "server-only"

function encodeObjectKey(key: string) {
  return key
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/")
}

export function toAssetUrl(storedValue: string | null | undefined) {
  if (!storedValue) return null

  const trimmed = storedValue.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  const normalized = trimmed.replace(/^\/+/, "")
  if (normalized.startsWith("api/files/")) {
    return `/${normalized}`
  }

  return `/api/files/${encodeObjectKey(normalized)}`
}

export function extractAssetKey(storedValue: string | null | undefined) {
  if (!storedValue) return null

  const trimmed = storedValue.trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed)
      if (parsed.pathname.startsWith("/api/files/")) {
        const keyPath = parsed.pathname.replace(/^\/api\/files\//, "")
        return keyPath
          .split("/")
          .filter(Boolean)
          .map((segment) => decodeURIComponent(segment))
          .join("/")
      }
      return null
    } catch {
      return null
    }
  }

  if (trimmed.startsWith("/api/files/")) {
    return trimmed
      .replace(/^\/api\/files\//, "")
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join("/")
  }

  if (trimmed.startsWith("api/files/")) {
    return trimmed
      .replace(/^api\/files\//, "")
      .split("/")
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment))
      .join("/")
  }

  return trimmed.replace(/^\/+/, "")
}
