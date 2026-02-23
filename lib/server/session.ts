import "server-only"

import { createHmac, timingSafeEqual } from "crypto"
import { NextRequest, NextResponse } from "next/server"

const SESSION_COOKIE_NAME = "app_session"
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30

type SessionPayload = {
  userId: string
  exp: number
}

function normalizeString(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function getSessionSecret() {
  return (
    process.env.AUTH_SESSION_SECRET ||
    process.env.SESSION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    "development-insecure-session-secret"
  )
}

function signPayload(payload: string) {
  return createHmac("sha256", getSessionSecret()).update(payload).digest("hex")
}

function safeHexEquals(a: string, b: string) {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"))
  } catch {
    return false
  }
}

export function createSessionToken(userId: string, ttlSeconds: number = DEFAULT_TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000)
  const exp = now + Math.max(60, ttlSeconds)
  const payload = `${userId}.${exp}`
  const signature = signPayload(payload)
  return `${payload}.${signature}`
}

export function verifySessionToken(token: string | null | undefined): SessionPayload | null {
  const normalized = normalizeString(token)
  if (!normalized) return null

  const parts = normalized.split(".")
  if (parts.length !== 3) return null

  const [userIdRaw, expRaw, signature] = parts
  const userId = normalizeString(userIdRaw)
  const exp = Number.parseInt(expRaw, 10)

  if (!userId || !Number.isFinite(exp)) return null
  if (exp <= Math.floor(Date.now() / 1000)) return null

  const payload = `${userId}.${exp}`
  const expectedSignature = signPayload(payload)
  if (!safeHexEquals(signature, expectedSignature)) return null

  return { userId, exp }
}

export function resolveSessionUserIdFromRequest(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value
  const payload = verifySessionToken(token)
  return payload?.userId ?? null
}

export function setSessionCookie(
  response: NextResponse,
  token: string,
  ttlSeconds: number = DEFAULT_TTL_SECONDS
) {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: Math.max(60, ttlSeconds),
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

