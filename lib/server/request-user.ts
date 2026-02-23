import "server-only"

import { NextRequest } from "next/server"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

const DEFAULT_USER_ID = "anonymous"

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function resolveUserIdFromRequest(request: NextRequest, explicitUserId?: unknown) {
  const explicit = asNonEmptyString(explicitUserId)
  if (explicit) return explicit

  const headerValue = asNonEmptyString(request.headers.get("x-user-id"))
  if (headerValue) return headerValue

  const sessionUserId = asNonEmptyString(resolveSessionUserIdFromRequest(request))
  if (sessionUserId) return sessionUserId

  const url = new URL(request.url)
  const queryValue = asNonEmptyString(url.searchParams.get("userId"))
  if (queryValue) return queryValue

  return DEFAULT_USER_ID
}

export function resolveUserIdValue(value: unknown) {
  return asNonEmptyString(value) ?? DEFAULT_USER_ID
}

export function parsePositiveInt(value: string | null) {
  if (!value) return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}
