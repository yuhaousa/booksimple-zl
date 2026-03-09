import { NextRequest, NextResponse } from "next/server"

import { getD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

// Resend HTTP API — works in Cloudflare Workers (no TCP sockets needed)
const KEYS = {
  apiKey: "email_resend_api_key",
  from: "email_from",
  fromName: "email_from_name",
  to: "email_to",
} as const

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function requireAdminAccess(request: NextRequest) {
  const db = getD1Database()
  if (!db) {
    return { error: NextResponse.json({ error: "D1 not configured" }, { status: 503 }), db: null, userId: null }
  }
  const userId = normalizeValue(resolveSessionUserIdFromRequest(request))
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), db: null, userId: null }
  }
  try {
    const adminRow = (await db
      .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first()) as { user_id: string } | null
    if (!adminRow) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), db: null, userId: null }
    }
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: "Failed to verify admin", details: error instanceof Error ? error.message : "Unknown" },
        { status: 500 }
      ),
      db: null,
      userId: null,
    }
  }
  return { db, userId, error: null }
}

async function getEmailSettings(db: any) {
  const rows = (await db
    .prepare(`SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN (?, ?, ?, ?)`)
    .bind(KEYS.apiKey, KEYS.from, KEYS.fromName, KEYS.to)
    .all()) as { results: { setting_key: string; setting_value: string }[] }

  const map: Record<string, string> = {}
  for (const row of rows.results ?? []) {
    map[row.setting_key] = row.setting_value
  }

  const apiKey = map[KEYS.apiKey]
  return {
    apiKeyConfigured: Boolean(apiKey),
    apiKeyPreview: apiKey ? `${apiKey.slice(0, 7)}${"*".repeat(Math.max(0, apiKey.length - 7))}` : null,
    from: map[KEYS.from] ?? null,
    fromName: map[KEYS.fromName] ?? null,
    to: map[KEYS.to] ?? null,
  }
}

export async function GET(request: NextRequest) {
  const access = await requireAdminAccess(request)
  if (access.error) return access.error
  try {
    const emailSettings = await getEmailSettings(access.db)
    return NextResponse.json({ success: true, ...emailSettings })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load email settings", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireAdminAccess(request)
  if (access.error) return access.error

  const { db, userId } = access
  const body = await request.json().catch(() => null)
  const now = new Date().toISOString()

  const updates: { setting_key: string; setting_value: string; updated_at: string; updated_by: string }[] = []

  const fieldMap: [string, keyof typeof KEYS][] = [
    ["apiKey", "apiKey"],
    ["from", "from"],
    ["fromName", "fromName"],
    ["to", "to"],
  ]

  for (const [bodyKey, settingKey] of fieldMap) {
    const value = normalizeValue(body?.[bodyKey])
    if (value !== null) {
      updates.push({ setting_key: KEYS[settingKey], setting_value: value, updated_at: now, updated_by: userId! })
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No settings provided" }, { status: 400 })
  }

  const statements = updates.map((u) =>
    db
      .prepare(
        `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .bind(u.setting_key, u.setting_value, u.updated_at, u.updated_by)
  )

  try {
    if (typeof db.batch === "function") {
      await db.batch(statements)
    } else {
      for (const s of statements) await s.run()
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to save email settings", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }

  const emailSettings = await getEmailSettings(db)
  return NextResponse.json({ success: true, message: "Email settings saved", ...emailSettings })
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminAccess(request)
  if (access.error) return access.error

  const { db } = access
  const allKeys = Object.values(KEYS)
  const placeholders = allKeys.map(() => "?").join(", ")

  try {
    await db
      .prepare(`DELETE FROM admin_settings WHERE setting_key IN (${placeholders})`)
      .bind(...allKeys)
      .run()
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to clear email settings", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }

  return NextResponse.json({ success: true, message: "Email settings cleared" })
}
