import "server-only"

import OpenAI from "openai"
import { createClient } from "@supabase/supabase-js"

export type AIProvider = "openai" | "minimax"
export type OpenAIKeySource = "environment" | "database" | "none"
export type SettingSource = "environment" | "database" | "default"

const OPENAI_SETTING_KEY = "openai_api_key"
const OPENAI_MODEL_KEY = "openai_model"
const MINIMAX_SETTING_KEY = "minimax_api_key"
const MINIMAX_MODEL_KEY = "minimax_model"
const MINIMAX_BASE_URL_KEY = "minimax_base_url"
const DEFAULT_PROVIDER_KEY = "ai_default_provider"

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
const DEFAULT_MINIMAX_MODEL = "MiniMax-Text-01"
const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.chat/v1"

type SettingsMap = Record<string, { value: string; updatedAt: string | null }>

type ProviderRuntime = {
  provider: AIProvider
  apiKey: string | null
  keySource: OpenAIKeySource
  keyUpdatedAt: string | null
  model: string
  modelSource: SettingSource
  baseURL?: string
  baseURLSource?: SettingSource
}

export type AIConfigurationStatus = {
  activeProvider: AIProvider | "none"
  activeModel: string | null
  activeKeySource: OpenAIKeySource
  activeKeyPreview: string | null
  defaultProvider: AIProvider
  defaultProviderSource: SettingSource
  openai: {
    environmentKeyConfigured: boolean
    databaseKeyConfigured: boolean
    databaseKeyPreview: string | null
    model: string
    modelSource: SettingSource
    environmentOverridesDatabase: boolean
    keyUpdatedAt: string | null
  }
  minimax: {
    environmentKeyConfigured: boolean
    databaseKeyConfigured: boolean
    databaseKeyPreview: string | null
    model: string
    modelSource: SettingSource
    baseURL: string
    baseURLSource: SettingSource
    environmentOverridesDatabase: boolean
    keyUpdatedAt: string | null
  }
}

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

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

function normalizeValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function asProvider(value: string | null | undefined): AIProvider | null {
  if (value === "openai" || value === "minimax") return value
  return null
}

function getEnvSetting(name: string) {
  return normalizeValue(process.env[name])
}

async function getSettingsMap(): Promise<SettingsMap> {
  const adminClient = createAdminClient()
  if (!adminClient) return {}

  const keys = [
    OPENAI_SETTING_KEY,
    OPENAI_MODEL_KEY,
    MINIMAX_SETTING_KEY,
    MINIMAX_MODEL_KEY,
    MINIMAX_BASE_URL_KEY,
    DEFAULT_PROVIDER_KEY,
  ]

  const { data, error } = await adminClient
    .from("admin_settings")
    .select("setting_key, setting_value, updated_at")
    .in("setting_key", keys)

  if (error || !data) return {}

  const map: SettingsMap = {}
  for (const row of data) {
    const normalized = normalizeValue(row.setting_value)
    if (!normalized) continue
    map[row.setting_key] = {
      value: normalized,
      updatedAt: row.updated_at ?? null,
    }
  }
  return map
}

function resolveModel(
  provider: AIProvider,
  settings: SettingsMap,
  overrideOpenAIModel?: string,
  overrideMiniMaxModel?: string
) {
  if (provider === "openai") {
    const envModel = getEnvSetting("OPENAI_MODEL")
    if (envModel) return { model: envModel, source: "environment" as const }
    const dbModel = settings[OPENAI_MODEL_KEY]?.value
    if (dbModel) return { model: dbModel, source: "database" as const }
    return { model: overrideOpenAIModel || DEFAULT_OPENAI_MODEL, source: "default" as const }
  }

  const envModel = getEnvSetting("MINIMAX_MODEL")
  if (envModel) return { model: envModel, source: "environment" as const }
  const dbModel = settings[MINIMAX_MODEL_KEY]?.value
  if (dbModel) return { model: dbModel, source: "database" as const }
  return { model: overrideMiniMaxModel || DEFAULT_MINIMAX_MODEL, source: "default" as const }
}

function resolveMinimaxBaseURL(settings: SettingsMap) {
  const envBaseURL = getEnvSetting("MINIMAX_BASE_URL")
  if (envBaseURL) return { baseURL: envBaseURL, source: "environment" as const }
  const dbBaseURL = settings[MINIMAX_BASE_URL_KEY]?.value
  if (dbBaseURL) return { baseURL: dbBaseURL, source: "database" as const }
  return { baseURL: DEFAULT_MINIMAX_BASE_URL, source: "default" as const }
}

function resolveProvider(settings: SettingsMap): { provider: AIProvider; source: SettingSource } {
  const envProvider = asProvider(getEnvSetting("AI_DEFAULT_PROVIDER"))
  if (envProvider) return { provider: envProvider, source: "environment" }

  const dbProvider = asProvider(settings[DEFAULT_PROVIDER_KEY]?.value)
  if (dbProvider) return { provider: dbProvider, source: "database" }

  return { provider: "openai", source: "default" }
}

function resolveProviderKey(
  provider: AIProvider,
  settings: SettingsMap
): { apiKey: string | null; source: OpenAIKeySource; updatedAt: string | null } {
  if (provider === "openai") {
    const envKey = getEnvSetting("OPENAI_API_KEY")
    if (envKey) return { apiKey: envKey, source: "environment", updatedAt: null }
    const dbKey = settings[OPENAI_SETTING_KEY]
    if (dbKey?.value) return { apiKey: dbKey.value, source: "database", updatedAt: dbKey.updatedAt }
    return { apiKey: null, source: "none", updatedAt: null }
  }

  const envKey = getEnvSetting("MINIMAX_API_KEY")
  if (envKey) return { apiKey: envKey, source: "environment", updatedAt: null }
  const dbKey = settings[MINIMAX_SETTING_KEY]
  if (dbKey?.value) return { apiKey: dbKey.value, source: "database", updatedAt: dbKey.updatedAt }
  return { apiKey: null, source: "none", updatedAt: null }
}

function resolveProviderRuntime(
  provider: AIProvider,
  settings: SettingsMap,
  openaiModel?: string,
  minimaxModel?: string
): ProviderRuntime {
  const keyConfig = resolveProviderKey(provider, settings)
  const modelConfig = resolveModel(provider, settings, openaiModel, minimaxModel)

  if (provider === "openai") {
    return {
      provider,
      apiKey: keyConfig.apiKey,
      keySource: keyConfig.source,
      keyUpdatedAt: keyConfig.updatedAt,
      model: modelConfig.model,
      modelSource: modelConfig.source,
    }
  }

  const baseURLConfig = resolveMinimaxBaseURL(settings)
  return {
    provider,
    apiKey: keyConfig.apiKey,
    keySource: keyConfig.source,
    keyUpdatedAt: keyConfig.updatedAt,
    model: modelConfig.model,
    modelSource: modelConfig.source,
    baseURL: baseURLConfig.baseURL,
    baseURLSource: baseURLConfig.source,
  }
}

export function maskApiKey(apiKey: string | null) {
  if (!apiKey) return null
  if (apiKey.length <= 12) return `${apiKey.slice(0, 2)}***${apiKey.slice(-2)}`
  return `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`
}

export async function getAIConfigurationStatus(): Promise<AIConfigurationStatus> {
  const settings = await getSettingsMap()

  const defaultProviderConfig = resolveProvider(settings)
  const openaiRuntime = resolveProviderRuntime("openai", settings)
  const minimaxRuntime = resolveProviderRuntime("minimax", settings)

  const activeRuntimeBase =
    defaultProviderConfig.provider === "openai" ? openaiRuntime : minimaxRuntime
  const activeRuntime =
    activeRuntimeBase.apiKey
      ? activeRuntimeBase
      : openaiRuntime.apiKey
      ? openaiRuntime
      : minimaxRuntime.apiKey
      ? minimaxRuntime
      : activeRuntimeBase

  return {
    activeProvider: activeRuntime.apiKey ? activeRuntime.provider : "none",
    activeModel: activeRuntime.apiKey ? activeRuntime.model : null,
    activeKeySource: activeRuntime.keySource,
    activeKeyPreview: maskApiKey(activeRuntime.apiKey),
    defaultProvider: defaultProviderConfig.provider,
    defaultProviderSource: defaultProviderConfig.source,
    openai: {
      environmentKeyConfigured: Boolean(getEnvSetting("OPENAI_API_KEY")),
      databaseKeyConfigured: Boolean(settings[OPENAI_SETTING_KEY]?.value),
      databaseKeyPreview: maskApiKey(settings[OPENAI_SETTING_KEY]?.value ?? null),
      model: openaiRuntime.model,
      modelSource: openaiRuntime.modelSource,
      environmentOverridesDatabase: Boolean(getEnvSetting("OPENAI_API_KEY") && settings[OPENAI_SETTING_KEY]?.value),
      keyUpdatedAt: settings[OPENAI_SETTING_KEY]?.updatedAt ?? null,
    },
    minimax: {
      environmentKeyConfigured: Boolean(getEnvSetting("MINIMAX_API_KEY")),
      databaseKeyConfigured: Boolean(settings[MINIMAX_SETTING_KEY]?.value),
      databaseKeyPreview: maskApiKey(settings[MINIMAX_SETTING_KEY]?.value ?? null),
      model: minimaxRuntime.model,
      modelSource: minimaxRuntime.modelSource,
      baseURL: minimaxRuntime.baseURL || DEFAULT_MINIMAX_BASE_URL,
      baseURLSource: minimaxRuntime.baseURLSource || "default",
      environmentOverridesDatabase: Boolean(getEnvSetting("MINIMAX_API_KEY") && settings[MINIMAX_SETTING_KEY]?.value),
      keyUpdatedAt: settings[MINIMAX_SETTING_KEY]?.updatedAt ?? null,
    },
  }
}

export async function getConfiguredOpenAIKey() {
  const settings = await getSettingsMap()
  const defaultProviderConfig = resolveProvider(settings)
  const preferredRuntime = resolveProviderRuntime(defaultProviderConfig.provider, settings)
  const fallbackRuntime = resolveProviderRuntime(
    defaultProviderConfig.provider === "openai" ? "minimax" : "openai",
    settings
  )
  const activeRuntime = preferredRuntime.apiKey ? preferredRuntime : fallbackRuntime.apiKey ? fallbackRuntime : preferredRuntime

  return {
    apiKey: activeRuntime.apiKey,
    source: activeRuntime.keySource,
    updatedAt: activeRuntime.keyUpdatedAt,
    provider: activeRuntime.provider,
    model: activeRuntime.model,
  }
}

export async function createConfiguredOpenAIClient(options?: {
  openaiModel?: string
  minimaxModel?: string
}) {
  const settings = await getSettingsMap()
  const defaultProviderConfig = resolveProvider(settings)

  const preferredRuntime = resolveProviderRuntime(
    defaultProviderConfig.provider,
    settings,
    options?.openaiModel,
    options?.minimaxModel
  )

  const fallbackProvider: AIProvider = defaultProviderConfig.provider === "openai" ? "minimax" : "openai"
  const fallbackRuntime = resolveProviderRuntime(
    fallbackProvider,
    settings,
    options?.openaiModel,
    options?.minimaxModel
  )

  const activeRuntime = preferredRuntime.apiKey
    ? preferredRuntime
    : fallbackRuntime.apiKey
    ? fallbackRuntime
    : preferredRuntime

  if (!activeRuntime.apiKey) {
    return {
      client: null as OpenAI | null,
      source: "none" as OpenAIKeySource,
      updatedAt: null as string | null,
      provider: activeRuntime.provider,
      model: activeRuntime.model,
    }
  }

  const client =
    activeRuntime.provider === "openai"
      ? new OpenAI({ apiKey: activeRuntime.apiKey })
      : new OpenAI({
          apiKey: activeRuntime.apiKey,
          baseURL: activeRuntime.baseURL || DEFAULT_MINIMAX_BASE_URL,
        })

  return {
    client,
    source: activeRuntime.keySource,
    updatedAt: activeRuntime.keyUpdatedAt,
    provider: activeRuntime.provider,
    model: activeRuntime.model,
  }
}

