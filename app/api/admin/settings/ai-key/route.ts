import { NextRequest, NextResponse } from "next/server"

import { getD1Database } from "@/lib/server/cloudflare-bindings"
import { AIProvider, getAIConfigurationStatus } from "@/lib/server/openai-config"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

const OPENAI_SETTING_KEY = "openai_api_key"
const OPENAI_MODEL_KEY = "openai_model"
const MINIMAX_SETTING_KEY = "minimax_api_key"
const MINIMAX_MODEL_KEY = "minimax_model"
const MINIMAX_BASE_URL_KEY = "minimax_base_url"
const GOOGLE_SETTING_KEY = "google_api_key"
const GOOGLE_MODEL_KEY = "google_model"
const GOOGLE_BASE_URL_KEY = "google_base_url"
const DEFAULT_PROVIDER_KEY = "ai_default_provider"

type AdminAccessResult =
  | { error: NextResponse; db: null; userId: null }
  | { error: null; db: any; userId: string }

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asProvider(value: unknown): AIProvider | null {
  if (value === "openai" || value === "minimax" || value === "google") return value
  return null
}

function isMissingSettingsTableError(errorMessage: string) {
  const message = errorMessage.toLowerCase()
  return message.includes("admin_settings") && message.includes("no such table")
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

async function saveSettings(db: any, updates: { setting_key: string; setting_value: string; updated_at: string; updated_by: string }[]) {
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

  const status = await getAIConfigurationStatus()
  return NextResponse.json({ success: true, ...status })
}

export async function PUT(request: NextRequest) {
  const access = await requireAdminAccess(request)
  if (access.error) return access.error

  const { db, userId } = access
  const body = await request.json().catch(() => null)

  const updates: { setting_key: string; setting_value: string; updated_at: string; updated_by: string }[] = []
  const now = new Date().toISOString()

  const openaiApiKey = normalizeValue(body?.openaiApiKey)
  if (openaiApiKey) {
    if (!openaiApiKey.startsWith("sk-")) {
      return NextResponse.json({ error: "Invalid OpenAI API key format" }, { status: 400 })
    }
    updates.push({
      setting_key: OPENAI_SETTING_KEY,
      setting_value: openaiApiKey,
      updated_at: now,
      updated_by: userId,
    })
  }

  const minimaxApiKey = normalizeValue(body?.minimaxApiKey)
  if (minimaxApiKey) {
    updates.push({
      setting_key: MINIMAX_SETTING_KEY,
      setting_value: minimaxApiKey,
      updated_at: now,
      updated_by: userId,
    })
  }

  const openaiModel = normalizeValue(body?.openaiModel)
  if (openaiModel) {
    updates.push({
      setting_key: OPENAI_MODEL_KEY,
      setting_value: openaiModel,
      updated_at: now,
      updated_by: userId,
    })
  }

  const minimaxModel = normalizeValue(body?.minimaxModel)
  if (minimaxModel) {
    updates.push({
      setting_key: MINIMAX_MODEL_KEY,
      setting_value: minimaxModel,
      updated_at: now,
      updated_by: userId,
    })
  }

  const minimaxBaseUrl = normalizeValue(body?.minimaxBaseUrl)
  if (minimaxBaseUrl) {
    try {
      new URL(minimaxBaseUrl)
    } catch {
      return NextResponse.json({ error: "Invalid MiniMax base URL" }, { status: 400 })
    }

    updates.push({
      setting_key: MINIMAX_BASE_URL_KEY,
      setting_value: minimaxBaseUrl,
      updated_at: now,
      updated_by: userId,
    })
  }

  const googleApiKey = normalizeValue(body?.googleApiKey)
  if (googleApiKey) {
    updates.push({
      setting_key: GOOGLE_SETTING_KEY,
      setting_value: googleApiKey,
      updated_at: now,
      updated_by: userId,
    })
  }

  const googleModel = normalizeValue(body?.googleModel)
  if (googleModel) {
    updates.push({
      setting_key: GOOGLE_MODEL_KEY,
      setting_value: googleModel,
      updated_at: now,
      updated_by: userId,
    })
  }

  const googleBaseUrl = normalizeValue(body?.googleBaseUrl)
  if (googleBaseUrl) {
    try {
      new URL(googleBaseUrl)
    } catch {
      return NextResponse.json({ error: "Invalid Google base URL" }, { status: 400 })
    }

    updates.push({
      setting_key: GOOGLE_BASE_URL_KEY,
      setting_value: googleBaseUrl,
      updated_at: now,
      updated_by: userId,
    })
  }

  const defaultProvider = asProvider(body?.defaultProvider)
  if (body?.defaultProvider !== undefined) {
    if (!defaultProvider) {
      return NextResponse.json({ error: "defaultProvider must be openai, minimax, or google" }, { status: 400 })
    }
    updates.push({
      setting_key: DEFAULT_PROVIDER_KEY,
      setting_value: defaultProvider,
      updated_at: now,
      updated_by: userId,
    })
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "No settings provided to update" }, { status: 400 })
  }

  try {
    await saveSettings(db, updates)
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const status = isMissingSettingsTableError(message) ? 400 : 500
    return NextResponse.json(
      {
        error: "Failed to save AI settings",
        details: message,
        hint:
          status === 400
            ? "Run scripts/d1/001_schema.sql against D1 to create admin_settings."
            : undefined,
      },
      { status }
    )
  }

  const status = await getAIConfigurationStatus()
  return NextResponse.json({
    success: true,
    message: "AI settings saved successfully",
    ...status,
  })
}

export async function DELETE(request: NextRequest) {
  const access = await requireAdminAccess(request)
  if (access.error) return access.error

  const { db } = access

  const providerParam = request.nextUrl.searchParams.get("provider")
  let keysToDelete: string[] = []

  if (!providerParam || providerParam === "openai") {
    keysToDelete.push(OPENAI_SETTING_KEY)
  }
  if (providerParam === "minimax") {
    keysToDelete = [MINIMAX_SETTING_KEY]
  }
  if (providerParam === "google") {
    keysToDelete = [GOOGLE_SETTING_KEY]
  }
  if (providerParam === "all") {
    keysToDelete = [OPENAI_SETTING_KEY, MINIMAX_SETTING_KEY, GOOGLE_SETTING_KEY]
  }

  if (keysToDelete.length === 0) {
    return NextResponse.json({ error: "provider must be openai, minimax, google, or all" }, { status: 400 })
  }

  const placeholders = keysToDelete.map(() => "?").join(", ")
  try {
    await db
      .prepare(`DELETE FROM admin_settings WHERE setting_key IN (${placeholders})`)
      .bind(...keysToDelete)
      .run()
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const status = isMissingSettingsTableError(message) ? 400 : 500
    return NextResponse.json(
      {
        error: "Failed to clear AI key",
        details: message,
        hint:
          status === 400
            ? "Run scripts/d1/001_schema.sql against D1 to create admin_settings."
            : undefined,
      },
      { status }
    )
  }

  const status = await getAIConfigurationStatus()
  return NextResponse.json({
    success: true,
    message: "Stored AI key cleared",
    ...status,
  })
}
