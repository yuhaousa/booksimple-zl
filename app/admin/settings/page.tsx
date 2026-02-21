"use client"

import { useEffect, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase"
import { Eye, EyeOff, KeyRound, Loader2, RefreshCw, ShieldAlert } from "lucide-react"

type AIProvider = "openai" | "minimax"

type ProviderInfo = {
  environmentKeyConfigured: boolean
  databaseKeyConfigured: boolean
  databaseKeyPreview: string | null
  model: string
  modelSource: "environment" | "database" | "default"
  environmentOverridesDatabase: boolean
  keyUpdatedAt: string | null
}

type MiniMaxInfo = ProviderInfo & {
  baseURL: string
  baseURLSource: "environment" | "database" | "default"
}

type AISettingsResponse = {
  success: boolean
  activeProvider: AIProvider | "none"
  activeModel: string | null
  activeKeySource: "environment" | "database" | "none"
  activeKeyPreview: string | null
  defaultProvider: AIProvider
  defaultProviderSource: "environment" | "database" | "default"
  openai: ProviderInfo
  minimax: MiniMaxInfo
}

const DEFAULT_SETTINGS: AISettingsResponse = {
  success: true,
  activeProvider: "none",
  activeModel: null,
  activeKeySource: "none",
  activeKeyPreview: null,
  defaultProvider: "openai",
  defaultProviderSource: "default",
  openai: {
    environmentKeyConfigured: false,
    databaseKeyConfigured: false,
    databaseKeyPreview: null,
    model: "gpt-4o-mini",
    modelSource: "default",
    environmentOverridesDatabase: false,
    keyUpdatedAt: null,
  },
  minimax: {
    environmentKeyConfigured: false,
    databaseKeyConfigured: false,
    databaseKeyPreview: null,
    model: "MiniMax-Text-01",
    modelSource: "default",
    environmentOverridesDatabase: false,
    keyUpdatedAt: null,
    baseURL: "https://api.minimax.chat/v1",
    baseURLSource: "default",
  },
}

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth(true)

  const [isAdmin, setIsAdmin] = useState(false)
  const [checkingAdmin, setCheckingAdmin] = useState(true)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [saving, setSaving] = useState(false)

  const [showOpenAIKey, setShowOpenAIKey] = useState(false)
  const [showMiniMaxKey, setShowMiniMaxKey] = useState(false)

  const [settings, setSettings] = useState<AISettingsResponse>(DEFAULT_SETTINGS)

  const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini")

  const [minimaxApiKey, setMinimaxApiKey] = useState("")
  const [minimaxModel, setMinimaxModel] = useState("MiniMax-Text-01")
  const [minimaxBaseUrl, setMinimaxBaseUrl] = useState("https://api.minimax.chat/v1")

  const [defaultProvider, setDefaultProvider] = useState<AIProvider>("openai")

  const hydrateForm = (result: AISettingsResponse) => {
    setOpenaiModel(result.openai.model || "gpt-4o-mini")
    setMinimaxModel(result.minimax.model || "MiniMax-Text-01")
    setMinimaxBaseUrl(result.minimax.baseURL || "https://api.minimax.chat/v1")
    setDefaultProvider(result.defaultProvider || "openai")
  }

  const fetchSettings = async () => {
    setLoadingSettings(true)
    try {
      const response = await fetch("/api/admin/settings/ai-key")
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result?.details || result?.error || "Failed to load AI settings")
      }

      setSettings(result)
      hydrateForm(result)
    } catch (error: any) {
      toast({
        title: "Failed to load settings",
        description: error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setLoadingSettings(false)
    }
  }

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false

    const checkAdmin = async () => {
      setCheckingAdmin(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from("admin_users")
          .select("user_id")
          .eq("user_id", user.id)
          .maybeSingle()

        if (error || !data) {
          router.push("/")
          return
        }

        if (!cancelled) {
          setIsAdmin(true)
          await fetchSettings()
        }
      } catch {
        router.push("/")
      } finally {
        if (!cancelled) {
          setCheckingAdmin(false)
        }
      }
    }

    checkAdmin()

    return () => {
      cancelled = true
    }
  }, [authLoading, user, router])

  const saveSettings = async (payload: Record<string, string>) => {
    setSaving(true)
    try {
      const response = await fetch("/api/admin/settings/ai-key", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.details || result?.error || "Failed to save settings")
      }

      setSettings(result)
      hydrateForm(result)
      setOpenaiApiKey("")
      setMinimaxApiKey("")
      toast({
        title: "Saved",
        description: "AI settings updated successfully.",
      })
    } catch (error: any) {
      toast({
        title: "Save failed",
        description: error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveOpenAI = async (e: FormEvent) => {
    e.preventDefault()
    const payload: Record<string, string> = { openaiModel }
    const key = openaiApiKey.trim()
    if (key) payload.openaiApiKey = key
    await saveSettings(payload)
  }

  const handleSaveMiniMax = async (e: FormEvent) => {
    e.preventDefault()
    const payload: Record<string, string> = {
      minimaxModel,
      minimaxBaseUrl,
    }
    const key = minimaxApiKey.trim()
    if (key) payload.minimaxApiKey = key
    await saveSettings(payload)
  }

  const handleSaveDefaultProvider = async () => {
    await saveSettings({ defaultProvider })
  }

  const clearKey = async (provider: "openai" | "minimax") => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/settings/ai-key?provider=${provider}`, {
        method: "DELETE",
      })
      const result = await response.json()
      if (!response.ok) {
        throw new Error(result?.details || result?.error || "Failed to clear key")
      }
      setSettings(result)
      hydrateForm(result)
      toast({
        title: "Key cleared",
        description: `${provider === "openai" ? "OpenAI" : "MiniMax"} database key removed.`,
      })
    } catch (error: any) {
      toast({
        title: "Clear failed",
        description: error?.message || "Unknown error",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || checkingAdmin) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
          <p className="text-muted-foreground mt-2">Loading settings...</p>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking admin access...
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isAdmin) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Settings</h1>
        <p className="text-muted-foreground mt-2">Configure AI providers (OpenAI and MiniMax)</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            Active AI Provider
          </CardTitle>
          <CardDescription>Choose which provider the app should use by default.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={settings.activeProvider === "none" ? "secondary" : "default"}>
              Active: {settings.activeProvider}
            </Badge>
            {settings.activeModel && (
              <span className="text-sm text-muted-foreground">
                Model: {settings.activeModel} ({settings.activeKeySource})
              </span>
            )}
          </div>

          {(settings.openai.environmentOverridesDatabase || settings.minimax.environmentOverridesDatabase) && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <div className="flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 mt-0.5" />
                <div>
                  Environment variables override database keys for the same provider.
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-[220px_1fr] sm:items-center">
            <Label htmlFor="default-provider">Default Provider</Label>
            <div className="flex gap-2">
              <select
                id="default-provider"
                value={defaultProvider}
                onChange={(e) => setDefaultProvider(e.target.value as AIProvider)}
                className="flex h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <option value="openai">OpenAI</option>
                <option value="minimax">MiniMax</option>
              </select>
              <Button type="button" disabled={saving || loadingSettings} onClick={handleSaveDefaultProvider}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Current default source: {settings.defaultProviderSource}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>OpenAI</CardTitle>
          <CardDescription>Configure OpenAI key and model.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Key: {settings.openai.databaseKeyConfigured ? settings.openai.databaseKeyPreview : "not set"}
            {settings.openai.keyUpdatedAt && ` • Updated ${new Date(settings.openai.keyUpdatedAt).toLocaleString()}`}
          </div>
          <form onSubmit={handleSaveOpenAI} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="openai-key">OpenAI API Key (optional if unchanged)</Label>
              <div className="relative">
                <Input
                  id="openai-key"
                  type={showOpenAIKey ? "text" : "password"}
                  value={openaiApiKey}
                  onChange={(e) => setOpenaiApiKey(e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowOpenAIKey((v) => !v)}
                >
                  {showOpenAIKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="openai-model">OpenAI Model</Label>
              <Input
                id="openai-model"
                value={openaiModel}
                onChange={(e) => setOpenaiModel(e.target.value)}
                placeholder="gpt-4o-mini"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || loadingSettings}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save OpenAI
              </Button>
              <Button type="button" variant="destructive" disabled={saving} onClick={() => clearKey("openai")}>
                Clear OpenAI Key
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>MiniMax</CardTitle>
          <CardDescription>Configure MiniMax key, model, and base URL.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Key: {settings.minimax.databaseKeyConfigured ? settings.minimax.databaseKeyPreview : "not set"}
            {settings.minimax.keyUpdatedAt && ` • Updated ${new Date(settings.minimax.keyUpdatedAt).toLocaleString()}`}
          </div>
          <form onSubmit={handleSaveMiniMax} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="minimax-key">MiniMax API Key (optional if unchanged)</Label>
              <div className="relative">
                <Input
                  id="minimax-key"
                  type={showMiniMaxKey ? "text" : "password"}
                  value={minimaxApiKey}
                  onChange={(e) => setMinimaxApiKey(e.target.value)}
                  autoComplete="off"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowMiniMaxKey((v) => !v)}
                >
                  {showMiniMaxKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimax-model">MiniMax Model</Label>
              <Input
                id="minimax-model"
                value={minimaxModel}
                onChange={(e) => setMinimaxModel(e.target.value)}
                placeholder="MiniMax-Text-01"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minimax-baseurl">MiniMax Base URL</Label>
              <Input
                id="minimax-baseurl"
                value={minimaxBaseUrl}
                onChange={(e) => setMinimaxBaseUrl(e.target.value)}
                placeholder="https://api.minimax.chat/v1"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || loadingSettings}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save MiniMax
              </Button>
              <Button type="button" variant="destructive" disabled={saving} onClick={() => clearKey("minimax")}>
                Clear MiniMax Key
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="outline" disabled={loadingSettings} onClick={fetchSettings}>
          {loadingSettings ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>
    </div>
  )
}

