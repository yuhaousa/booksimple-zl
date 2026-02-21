import { NextRequest, NextResponse } from "next/server"
import { createServerClient } from "@supabase/ssr"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

import { AIProvider, getAIConfigurationStatus } from "@/lib/server/openai-config"

const OPENAI_SETTING_KEY = "openai_api_key"
const OPENAI_MODEL_KEY = "openai_model"
const MINIMAX_SETTING_KEY = "minimax_api_key"
const MINIMAX_MODEL_KEY = "minimax_model"
const MINIMAX_BASE_URL_KEY = "minimax_base_url"
const DEFAULT_PROVIDER_KEY = "ai_default_provider"

type AdminSupabaseClient = NonNullable<ReturnType<typeof createAdminClient>>
type AdminAccessResult =
  | { error: NextResponse; adminClient: null; userId: null }
  | { error: null; adminClient: AdminSupabaseClient; userId: string }

function getSupabaseEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  return { supabaseUrl, supabaseAnonKey, serviceRoleKey }
}

function createAdminClient() {
  const { supabaseUrl, serviceRoleKey } = getSupabaseEnv()
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function createUserServerClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()
  if (!supabaseUrl || !supabaseAnonKey) return null

  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

async function requireAdminAccess(): Promise<AdminAccessResult> {
  const userClient = await createUserServerClient()
  if (!userClient) {
    return {
      error: NextResponse.json({ error: "Supabase client is not configured" }, { status: 503 }),
      adminClient: null,
      userId: null,
    }
  }

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser()

  if (userError || !user) {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      adminClient: null,
      userId: null,
    }
  }

  const adminClient = createAdminClient()
  if (!adminClient) {
    return {
      error: NextResponse.json({ error: "Service role key is not configured" }, { status: 503 }),
      adminClient: null,
      userId: null,
    }
  }

  const { data: adminRow, error: adminError } = await adminClient
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (adminError) {
    return {
      error: NextResponse.json(
        { error: "Failed to verify admin permissions", details: adminError.message },
        { status: 500 }
      ),
      adminClient: null,
      userId: null,
    }
  }

  if (!adminRow) {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      adminClient: null,
      userId: null,
    }
  }

  return { adminClient, userId: user.id, error: null }
}

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asProvider(value: unknown): AIProvider | null {
  if (value === "openai" || value === "minimax") return value
  return null
}

function isMissingSettingsTableError(errorMessage: string) {
  return errorMessage.toLowerCase().includes("admin_settings")
}

export async function GET() {
  const access = await requireAdminAccess()
  if (access.error) return access.error

  const status = await getAIConfigurationStatus()
  return NextResponse.json({ success: true, ...status })
}

export async function PUT(request: NextRequest) {
  const access = await requireAdminAccess()
  if (access.error) return access.error

  const { adminClient, userId } = access
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

  const defaultProvider = asProvider(body?.defaultProvider)
  if (body?.defaultProvider !== undefined) {
    if (!defaultProvider) {
      return NextResponse.json({ error: "defaultProvider must be openai or minimax" }, { status: 400 })
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

  const { error: upsertError } = await adminClient
    .from("admin_settings")
    .upsert(updates, { onConflict: "setting_key" })

  if (upsertError) {
    const status = isMissingSettingsTableError(upsertError.message) ? 400 : 500
    return NextResponse.json(
      {
        error: "Failed to save AI settings",
        details: upsertError.message,
        hint:
          status === 400
            ? "Run scripts/create-admin-settings-table.sql in Supabase SQL editor first."
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
  const access = await requireAdminAccess()
  if (access.error) return access.error

  const { adminClient } = access

  const providerParam = request.nextUrl.searchParams.get("provider")
  let keysToDelete: string[] = []

  if (!providerParam || providerParam === "openai") {
    keysToDelete.push(OPENAI_SETTING_KEY)
  }
  if (providerParam === "minimax") {
    keysToDelete = [MINIMAX_SETTING_KEY]
  }
  if (providerParam === "all") {
    keysToDelete = [OPENAI_SETTING_KEY, MINIMAX_SETTING_KEY]
  }

  if (keysToDelete.length === 0) {
    return NextResponse.json({ error: "provider must be openai, minimax, or all" }, { status: 400 })
  }

  const { error: deleteError } = await adminClient
    .from("admin_settings")
    .delete()
    .in("setting_key", keysToDelete)

  if (deleteError) {
    const status = isMissingSettingsTableError(deleteError.message) ? 400 : 500
    return NextResponse.json(
      {
        error: "Failed to clear AI key",
        details: deleteError.message,
        hint:
          status === 400
            ? "Run scripts/create-admin-settings-table.sql in Supabase SQL editor first."
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

