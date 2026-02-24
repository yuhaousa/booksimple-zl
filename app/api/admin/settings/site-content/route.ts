import { NextRequest, NextResponse } from "next/server"

import { getD1Database } from "@/lib/server/cloudflare-bindings"
import { extractAssetKey, toAssetUrl } from "@/lib/server/storage"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

const SITE_LOGO_KEY = "site_logo_url"
const SITE_BANNERS_KEY = "site_banner_urls"

type AdminAccessResult =
  | { error: NextResponse; db: null; userId: null }
  | { error: null; db: any; userId: string }

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function isMissingSettingsTableError(errorMessage: string) {
  const message = errorMessage.toLowerCase()
  return message.includes("admin_settings") && message.includes("no such table")
}

function normalizeAssetValue(value: unknown) {
  const normalized = normalizeValue(value)
  if (!normalized) return null
  return extractAssetKey(normalized) ?? normalized
}

function normalizeBannerList(value: unknown) {
  if (!Array.isArray(value)) return null
  const deduped: string[] = []
  for (const item of value) {
    const normalized = normalizeAssetValue(item)
    if (!normalized) continue
    if (!deduped.includes(normalized)) deduped.push(normalized)
    if (deduped.length >= 10) break
  }
  return deduped
}

function parseStoredBannerList(value: string | null | undefined) {
  const normalized = normalizeValue(value)
  if (!normalized) return []

  try {
    const parsed = JSON.parse(normalized)
    if (!Array.isArray(parsed)) return []
    return normalizeBannerList(parsed) ?? []
  } catch {
    return []
  }
}

async function requireAdminAccess(request: NextRequest): Promise<AdminAccessResult> {
  const db = getD1Database()
  if (!db) {
    return {
      error: NextResponse.json({ error: "Cloudflare D1 binding `DB` is not configured" }, { status: 503 }),
      db: null,
      userId: null,
    }
  }

  const userId = normalizeValue(resolveSessionUserIdFromRequest(request))
  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized. Login first." }, { status: 401 }),
      db: null,
      userId: null,
    }
  }

  try {
    const adminRow = (await db
      .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first()) as { user_id: string } | null

    if (!adminRow) {
      return {
        error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        db: null,
        userId: null,
      }
    }
  } catch (error) {
    return {
      error: NextResponse.json(
        {
          error: "Failed to verify admin permissions",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      ),
      db: null,
      userId: null,
    }
  }

  return { db, userId, error: null }
}

async function readSiteContentSettings(db: any) {
  const result = (await db
    .prepare("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN (?, ?)")
    .bind(SITE_LOGO_KEY, SITE_BANNERS_KEY)
    .all()) as { results?: Array<{ setting_key: string; setting_value: string }> }

  const rows = result.results ?? []
  const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]))

  const logoStored = normalizeAssetValue(map.get(SITE_LOGO_KEY) ?? null)
  const bannerStoredList = parseStoredBannerList(map.get(SITE_BANNERS_KEY))

  return {
    logoUrl: toAssetUrl(logoStored),
    banners: bannerStoredList.map((item) => toAssetUrl(item)).filter((item): item is string => Boolean(item)),
  }
}

async function saveSettings(
  db: any,
  updates: { setting_key: string; setting_value: string; updated_at: string; updated_by: string }[]
) {
  const statements = updates.map((update) =>
    db
      .prepare(
        `INSERT INTO admin_settings (setting_key, setting_value, updated_at, updated_by)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(setting_key) DO UPDATE SET
           setting_value = excluded.setting_value,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .bind(update.setting_key, update.setting_value, update.updated_at, update.updated_by)
  )

  if (typeof db.batch === "function") {
    await db.batch(statements)
    return
  }

  for (const statement of statements) {
    await statement.run()
  }
}

export async function GET(request: NextRequest) {
  const access = await requireAdminAccess(request)
  if (access.error) return access.error

  try {
    const settings = await readSiteContentSettings(access.db)
    return NextResponse.json({ success: true, ...settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const status = isMissingSettingsTableError(message) ? 400 : 500
    return NextResponse.json(
      {
        error: "Failed to load site settings",
        details: message,
        hint: status === 400 ? "Run scripts/d1/001_schema.sql against D1 to create admin_settings." : undefined,
      },
      { status }
    )
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireAdminAccess(request)
  if (access.error) return access.error

  const { db, userId } = access
  const body = await request.json().catch(() => null)

  const hasLogo = Boolean(body && Object.prototype.hasOwnProperty.call(body, "logoUrl"))
  const hasBanners = Boolean(body && Object.prototype.hasOwnProperty.call(body, "banners"))

  if (!hasLogo && !hasBanners) {
    return NextResponse.json({ error: "No settings provided to update" }, { status: 400 })
  }

  const updates: { setting_key: string; setting_value: string; updated_at: string; updated_by: string }[] = []
  const deleteKeys: string[] = []
  const now = new Date().toISOString()

  if (hasLogo) {
    if (body.logoUrl === null) {
      deleteKeys.push(SITE_LOGO_KEY)
    } else {
      const logoValue = normalizeAssetValue(body.logoUrl)
      if (!logoValue) {
        return NextResponse.json({ error: "Invalid logoUrl value" }, { status: 400 })
      }
      updates.push({
        setting_key: SITE_LOGO_KEY,
        setting_value: logoValue,
        updated_at: now,
        updated_by: userId,
      })
    }
  }

  if (hasBanners) {
    const banners = normalizeBannerList(body.banners)
    if (!banners) {
      return NextResponse.json({ error: "banners must be an array of image URLs/keys" }, { status: 400 })
    }

    if (banners.length === 0) {
      deleteKeys.push(SITE_BANNERS_KEY)
    } else {
      updates.push({
        setting_key: SITE_BANNERS_KEY,
        setting_value: JSON.stringify(banners),
        updated_at: now,
        updated_by: userId,
      })
    }
  }

  try {
    if (deleteKeys.length > 0) {
      const placeholders = deleteKeys.map(() => "?").join(", ")
      await db
        .prepare(`DELETE FROM admin_settings WHERE setting_key IN (${placeholders})`)
        .bind(...deleteKeys)
        .run()
    }

    if (updates.length > 0) {
      await saveSettings(db, updates)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const status = isMissingSettingsTableError(message) ? 400 : 500
    return NextResponse.json(
      {
        error: "Failed to save site settings",
        details: message,
        hint: status === 400 ? "Run scripts/d1/001_schema.sql against D1 to create admin_settings." : undefined,
      },
      { status }
    )
  }

  const settings = await readSiteContentSettings(db)
  return NextResponse.json({
    success: true,
    message: "Site settings saved successfully",
    ...settings,
  })
}
