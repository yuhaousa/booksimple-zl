import "server-only"

import OpenAI from "openai"
import { getD1Database } from "@/lib/server/cloudflare-bindings"

export type AIProvider = "openai" | "minimax" | "google"
export type OpenAIKeySource = "environment" | "database" | "none"
export type SettingSource = "environment" | "database" | "default"

const OPENAI_SETTING_KEY = "openai_api_key"
const OPENAI_MODEL_KEY = "openai_model"
const MINIMAX_SETTING_KEY = "minimax_api_key"
const MINIMAX_MODEL_KEY = "minimax_model"
const MINIMAX_BASE_URL_KEY = "minimax_base_url"
const GOOGLE_SETTING_KEY = "google_api_key"
const GOOGLE_MODEL_KEY = "google_model"
const GOOGLE_BASE_URL_KEY = "google_base_url"
const DEFAULT_PROVIDER_KEY = "ai_default_provider"

const DEFAULT_OPENAI_MODEL = "gpt-4o-mini"
const DEFAULT_MINIMAX_MODEL = "MiniMax-M2.5"
const DEFAULT_MINIMAX_BASE_URL = "https://api.minimax.io/v1"
const DEFAULT_GOOGLE_MODEL = "gemini-2.0-flash"
const DEFAULT_GOOGLE_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
const ALL_PROVIDERS: AIProvider[] = ["openai", "minimax", "google"]

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
  google: {
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

type AdminSettingRow = {
  setting_key: string
  setting_value: string
  updated_at: string | null
}

function normalizeValue(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function asProvider(value: string | null | undefined): AIProvider | null {
  if (value === "openai" || value === "minimax" || value === "google") return value
  return null
}

function getEnvSetting(name: string) {
  return normalizeValue(process.env[name])
}

function getProviderOrder(defaultProvider: AIProvider): AIProvider[] {
  const ordered: AIProvider[] = [defaultProvider]
  for (const provider of ALL_PROVIDERS) {
    if (!ordered.includes(provider)) {
      ordered.push(provider)
    }
  }
  return ordered
}

async function getSettingsMap(): Promise<SettingsMap> {
  const db = getD1Database()
  if (!db) return {}

  const keys = [
    OPENAI_SETTING_KEY,
    OPENAI_MODEL_KEY,
    MINIMAX_SETTING_KEY,
    MINIMAX_MODEL_KEY,
    MINIMAX_BASE_URL_KEY,
    GOOGLE_SETTING_KEY,
    GOOGLE_MODEL_KEY,
    GOOGLE_BASE_URL_KEY,
    DEFAULT_PROVIDER_KEY,
  ]

  try {
    const result = await db
      .prepare("SELECT setting_key, setting_value, updated_at FROM admin_settings")
      .all()

    const rows = (result?.results ?? []) as AdminSettingRow[]
    if (!rows.length) return {}

    const allowed = new Set(keys)
    const map: SettingsMap = {}
    for (const row of rows) {
      if (!allowed.has(row.setting_key)) continue
      const normalized = normalizeValue(row.setting_value)
      if (!normalized) continue
      map[row.setting_key] = {
        value: normalized,
        updatedAt: row.updated_at ?? null,
      }
    }
    return map
  } catch {
    return {}
  }
}

function resolveModel(
  provider: AIProvider,
  settings: SettingsMap,
  overrideOpenAIModel?: string,
  overrideMiniMaxModel?: string,
  overrideGoogleModel?: string
) {
  if (provider === "openai") {
    const envModel = getEnvSetting("OPENAI_MODEL")
    if (envModel) return { model: envModel, source: "environment" as const }
    const dbModel = settings[OPENAI_MODEL_KEY]?.value
    if (dbModel) return { model: dbModel, source: "database" as const }
    return { model: overrideOpenAIModel || DEFAULT_OPENAI_MODEL, source: "default" as const }
  }

  if (provider === "minimax") {
    const envModel = getEnvSetting("MINIMAX_MODEL")
    if (envModel) return { model: envModel, source: "environment" as const }
    const dbModel = settings[MINIMAX_MODEL_KEY]?.value
    if (dbModel) return { model: dbModel, source: "database" as const }
    return { model: overrideMiniMaxModel || DEFAULT_MINIMAX_MODEL, source: "default" as const }
  }

  const envModel = getEnvSetting("GOOGLE_MODEL")
  if (envModel) return { model: envModel, source: "environment" as const }
  const dbModel = settings[GOOGLE_MODEL_KEY]?.value
  if (dbModel) return { model: dbModel, source: "database" as const }
  return { model: overrideGoogleModel || DEFAULT_GOOGLE_MODEL, source: "default" as const }
}

function resolveMinimaxBaseURL(settings: SettingsMap) {
  const envBaseURL = getEnvSetting("MINIMAX_BASE_URL")
  if (envBaseURL) return { baseURL: envBaseURL, source: "environment" as const }
  const dbBaseURL = settings[MINIMAX_BASE_URL_KEY]?.value
  if (dbBaseURL) return { baseURL: dbBaseURL, source: "database" as const }
  return { baseURL: DEFAULT_MINIMAX_BASE_URL, source: "default" as const }
}

function resolveGoogleBaseURL(settings: SettingsMap) {
  const envBaseURL = getEnvSetting("GOOGLE_BASE_URL")
  if (envBaseURL) return { baseURL: envBaseURL, source: "environment" as const }
  const dbBaseURL = settings[GOOGLE_BASE_URL_KEY]?.value
  if (dbBaseURL) return { baseURL: dbBaseURL, source: "database" as const }
  return { baseURL: DEFAULT_GOOGLE_BASE_URL, source: "default" as const }
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

  if (provider === "minimax") {
    const envKey = getEnvSetting("MINIMAX_API_KEY")
    if (envKey) return { apiKey: envKey, source: "environment", updatedAt: null }
    const dbKey = settings[MINIMAX_SETTING_KEY]
    if (dbKey?.value) return { apiKey: dbKey.value, source: "database", updatedAt: dbKey.updatedAt }
    return { apiKey: null, source: "none", updatedAt: null }
  }

  const envKey = getEnvSetting("GOOGLE_API_KEY")
  if (envKey) return { apiKey: envKey, source: "environment", updatedAt: null }
  const dbKey = settings[GOOGLE_SETTING_KEY]
  if (dbKey?.value) return { apiKey: dbKey.value, source: "database", updatedAt: dbKey.updatedAt }
  return { apiKey: null, source: "none", updatedAt: null }
}

function resolveProviderRuntime(
  provider: AIProvider,
  settings: SettingsMap,
  openaiModel?: string,
  minimaxModel?: string,
  googleModel?: string
): ProviderRuntime {
  const keyConfig = resolveProviderKey(provider, settings)
  const modelConfig = resolveModel(provider, settings, openaiModel, minimaxModel, googleModel)

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

  if (provider === "minimax") {
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

  const baseURLConfig = resolveGoogleBaseURL(settings)
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
  const googleRuntime = resolveProviderRuntime("google", settings)

  const runtimeByProvider: Record<AIProvider, ProviderRuntime> = {
    openai: openaiRuntime,
    minimax: minimaxRuntime,
    google: googleRuntime,
  }
  const providerOrder = getProviderOrder(defaultProviderConfig.provider)
  const activeRuntimeBase = runtimeByProvider[defaultProviderConfig.provider]
  const activeRuntime =
    providerOrder.map((provider) => runtimeByProvider[provider]).find((runtime) => Boolean(runtime.apiKey)) ?? activeRuntimeBase

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
    google: {
      environmentKeyConfigured: Boolean(getEnvSetting("GOOGLE_API_KEY")),
      databaseKeyConfigured: Boolean(settings[GOOGLE_SETTING_KEY]?.value),
      databaseKeyPreview: maskApiKey(settings[GOOGLE_SETTING_KEY]?.value ?? null),
      model: googleRuntime.model,
      modelSource: googleRuntime.modelSource,
      baseURL: googleRuntime.baseURL || DEFAULT_GOOGLE_BASE_URL,
      baseURLSource: googleRuntime.baseURLSource || "default",
      environmentOverridesDatabase: Boolean(getEnvSetting("GOOGLE_API_KEY") && settings[GOOGLE_SETTING_KEY]?.value),
      keyUpdatedAt: settings[GOOGLE_SETTING_KEY]?.updatedAt ?? null,
    },
  }
}

export async function getConfiguredOpenAIKey() {
  const settings = await getSettingsMap()
  const defaultProviderConfig = resolveProvider(settings)
  const runtimeByProvider: Record<AIProvider, ProviderRuntime> = {
    openai: resolveProviderRuntime("openai", settings),
    minimax: resolveProviderRuntime("minimax", settings),
    google: resolveProviderRuntime("google", settings),
  }
  const providerOrder = getProviderOrder(defaultProviderConfig.provider)
  const preferredRuntime = runtimeByProvider[defaultProviderConfig.provider]
  const activeRuntime =
    providerOrder.map((provider) => runtimeByProvider[provider]).find((runtime) => Boolean(runtime.apiKey)) ?? preferredRuntime

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
  googleModel?: string
}) {
  const settings = await getSettingsMap()
  const defaultProviderConfig = resolveProvider(settings)
  const runtimeByProvider: Record<AIProvider, ProviderRuntime> = {
    openai: resolveProviderRuntime("openai", settings, options?.openaiModel, options?.minimaxModel, options?.googleModel),
    minimax: resolveProviderRuntime("minimax", settings, options?.openaiModel, options?.minimaxModel, options?.googleModel),
    google: resolveProviderRuntime("google", settings, options?.openaiModel, options?.minimaxModel, options?.googleModel),
  }
  const providerOrder = getProviderOrder(defaultProviderConfig.provider)
  const preferredRuntime = runtimeByProvider[defaultProviderConfig.provider]
  const activeRuntime =
    providerOrder.map((provider) => runtimeByProvider[provider]).find((runtime) => Boolean(runtime.apiKey)) ?? preferredRuntime

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
          baseURL:
            activeRuntime.baseURL ||
            (activeRuntime.provider === "minimax" ? DEFAULT_MINIMAX_BASE_URL : DEFAULT_GOOGLE_BASE_URL),
        })

  return {
    client,
    source: activeRuntime.keySource,
    updatedAt: activeRuntime.keyUpdatedAt,
    provider: activeRuntime.provider,
    model: activeRuntime.model,
  }
}
