import { NextResponse } from "next/server"

import { getD1Database } from "@/lib/server/cloudflare-bindings"
import { extractAssetKey, toAssetUrl } from "@/lib/server/storage"

const SITE_LOGO_KEY = "site_logo_url"
const SITE_BANNERS_KEY = "site_banner_urls"

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function normalizeAssetValue(value: unknown) {
  const normalized = normalizeValue(value)
  if (!normalized) return null
  return extractAssetKey(normalized) ?? normalized
}

function parseStoredBannerList(value: string | null | undefined) {
  const normalized = normalizeValue(value)
  if (!normalized) return []

  try {
    const parsed = JSON.parse(normalized)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => normalizeAssetValue(item))
      .filter((item): item is string => Boolean(item))
      .slice(0, 10)
  } catch {
    return []
  }
}

export async function GET() {
  const db = getD1Database()
  if (!db) {
    return NextResponse.json({ success: true, logoUrl: null, banners: [] })
  }

  try {
    const result = (await db
      .prepare("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN (?, ?)")
      .bind(SITE_LOGO_KEY, SITE_BANNERS_KEY)
      .all()) as { results?: Array<{ setting_key: string; setting_value: string }> }

    const rows = result.results ?? []
    const map = new Map(rows.map((row) => [row.setting_key, row.setting_value]))

    const logoStored = normalizeAssetValue(map.get(SITE_LOGO_KEY) ?? null)
    const bannerStoredList = parseStoredBannerList(map.get(SITE_BANNERS_KEY))

    return NextResponse.json({
      success: true,
      logoUrl: toAssetUrl(logoStored),
      banners: bannerStoredList.map((item) => toAssetUrl(item)).filter((item): item is string => Boolean(item)),
    })
  } catch {
    return NextResponse.json({ success: true, logoUrl: null, banners: [] })
  }
}
