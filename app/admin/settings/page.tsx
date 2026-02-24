"use client"

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react"
import { useRouter } from "next/navigation"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/hooks/use-auth"
import { Eye, EyeOff, KeyRound, Loader2, RefreshCw, ShieldAlert, Trash2, Upload } from "lucide-react"

type AIProvider = "openai" | "minimax" | "google"

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

type GoogleInfo = ProviderInfo & {
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
  google: GoogleInfo
}

type SiteSettingsResponse = {
  success: boolean
  logoUrl: string | null
  banners: string[]
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
  google: {
    environmentKeyConfigured: false,
    databaseKeyConfigured: false,
    databaseKeyPreview: null,
    model: "gemini-2.0-flash",
    modelSource: "default",
    environmentOverridesDatabase: false,
    keyUpdatedAt: null,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
    baseURLSource: "default",
  },
}

const DEFAULT_SITE_SETTINGS: SiteSettingsResponse = {
  success: true,
  logoUrl: null,
  banners: [],
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
  const [showGoogleKey, setShowGoogleKey] = useState(false)

  const [settings, setSettings] = useState<AISettingsResponse>(DEFAULT_SETTINGS)
  const [siteSettings, setSiteSettings] = useState<SiteSettingsResponse>(DEFAULT_SITE_SETTINGS)

  const [openaiApiKey, setOpenaiApiKey] = useState("")
  const [openaiModel, setOpenaiModel] = useState("gpt-4o-mini")

  const [minimaxApiKey, setMinimaxApiKey] = useState("")
  const [minimaxModel, setMinimaxModel] = useState("MiniMax-Text-01")
  const [minimaxBaseUrl, setMinimaxBaseUrl] = useState("https://api.minimax.chat/v1")
  const [googleApiKey, setGoogleApiKey] = useState("")
  const [googleModel, setGoogleModel] = useState("gemini-2.0-flash")
  const [googleBaseUrl, setGoogleBaseUrl] = useState("https://generativelanguage.googleapis.com/v1beta/openai/")

  const [defaultProvider, setDefaultProvider] = useState<AIProvider>("openai")
  const [logoUploading, setLogoUploading] = useState(false)
  const [bannersUploading, setBannersUploading] = useState(false)

  const hydrateForm = (result: AISettingsResponse) => {
    setOpenaiModel(result.openai.model || "gpt-4o-mini")
    setMinimaxModel(result.minimax.model || "MiniMax-Text-01")
    setMinimaxBaseUrl(result.minimax.baseURL || "https://api.minimax.chat/v1")
    setGoogleModel(result.google.model || "gemini-2.0-flash")
    setGoogleBaseUrl(result.google.baseURL || "https://generativelanguage.googleapis.com/v1beta/openai/")
    setDefaultProvider(result.defaultProvider || "openai")
  }

  const fetchSettings = async () => {
    setLoadingSettings(true)
    try {
      const response = await fetch("/api/admin/settings/ai-key")
      const result = await response.json()

      if (response.status === 401) {
        setIsAdmin(false)
        router.push("/login")
        return
      }
      if (response.status === 403) {
        setIsAdmin(false)
        router.push("/")
        return
      }

      if (!response.ok) {
        throw new Error(result?.details || result?.error || "Failed to load AI settings")
      }

      setSettings(result)
      hydrateForm(result)
      await fetchSiteContentSettings(false)
      setIsAdmin(true)
    } catch (error: any) {
      toast({
        title: "Failed to load settings",
        description: error?.message || "Unknown error",
        variant: "destructive",
      })
      setIsAdmin(false)
    } finally {
      setLoadingSettings(false)
    }
  }

  const fetchSiteContentSettings = async (showErrorToast = true) => {
    try {
      const response = await fetch("/api/admin/settings/site-content", { cache: "no-store" })
      const result = await response.json().catch(() => null)

      if (response.status === 401) {
        setIsAdmin(false)
        router.push("/login")
        return
      }
      if (response.status === 403) {
        setIsAdmin(false)
        router.push("/")
        return
      }

      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to load site settings")
      }

      setSiteSettings({
        success: true,
        logoUrl: typeof result.logoUrl === "string" ? result.logoUrl : null,
        banners: Array.isArray(result.banners) ? result.banners.filter((item: unknown) => typeof item === "string") : [],
      })
    } catch (error: any) {
      if (showErrorToast) {
        toast({
          title: "Failed to load site settings",
          description: error?.message || "Unknown error",
          variant: "destructive",
        })
      }
    }
  }

  useEffect(() => {
    if (authLoading || !user) return

    let cancelled = false

    const checkAdminAndLoad = async () => {
      setCheckingAdmin(true)
      try {
        if (!cancelled) await fetchSettings()
      } catch {
        if (!cancelled) setIsAdmin(false)
      } finally {
        if (!cancelled) {
          setCheckingAdmin(false)
        }
      }
    }

    void checkAdminAndLoad()

    return () => {
      cancelled = true
    }
  }, [authLoading, user])

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
      setGoogleApiKey("")
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

  const handleSaveGoogle = async (e: FormEvent) => {
    e.preventDefault()
    const payload: Record<string, string> = {
      googleModel,
      googleBaseUrl,
    }
    const key = googleApiKey.trim()
    if (key) payload.googleApiKey = key
    await saveSettings(payload)
  }

  const handleSaveDefaultProvider = async () => {
    await saveSettings({ defaultProvider })
  }

  const clearKey = async (provider: "openai" | "minimax" | "google") => {
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
      const providerName = provider === "openai" ? "OpenAI" : provider === "minimax" ? "MiniMax" : "Google"
      toast({
        title: "Key cleared",
        description: `${providerName} database key removed.`,
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

  const saveSiteContentSettings = async (payload: { logoUrl?: string | null; banners?: string[] }, successMessage: string) => {
    setSaving(true)
    try {
      const response = await fetch("/api/admin/settings/site-content", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to save site settings")
      }

      setSiteSettings({
        success: true,
        logoUrl: typeof result.logoUrl === "string" ? result.logoUrl : null,
        banners: Array.isArray(result.banners) ? result.banners.filter((item: unknown) => typeof item === "string") : [],
      })
      toast({
        title: "Saved",
        description: successMessage,
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

  const uploadSiteAsset = async (file: File, kind: "site-logo" | "site-banner") => {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("kind", kind)

    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: formData,
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success || typeof result?.key !== "string") {
      throw new Error(result?.details || result?.error || "Failed to upload file")
    }
    return result.key as string
  }

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return

    setLogoUploading(true)
    try {
      const key = await uploadSiteAsset(file, "site-logo")
      await saveSiteContentSettings({ logoUrl: key }, "Site logo updated.")
    } finally {
      setLogoUploading(false)
    }
  }

  const handleBannerUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (files.length === 0) return

    setBannersUploading(true)
    try {
      const uploadedKeys: string[] = []
      for (const file of files) {
        const key = await uploadSiteAsset(file, "site-banner")
        uploadedKeys.push(key)
      }

      const nextBanners = [...siteSettings.banners, ...uploadedKeys].slice(0, 10)
      await saveSiteContentSettings({ banners: nextBanners }, "Banner images updated.")
    } finally {
      setBannersUploading(false)
    }
  }

  const handleRemoveLogo = async () => {
    await saveSiteContentSettings({ logoUrl: null }, "Site logo removed.")
  }

  const handleRemoveBanner = async (index: number) => {
    const nextBanners = siteSettings.banners.filter((_, i) => i !== index)
    await saveSiteContentSettings({ banners: nextBanners }, "Banner image removed.")
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
        <p className="text-muted-foreground mt-2">Configure AI providers (OpenAI, Google, and MiniMax)</p>
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

          {(settings.openai.environmentOverridesDatabase ||
            settings.minimax.environmentOverridesDatabase ||
            settings.google.environmentOverridesDatabase) && (
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
                <option value="google">Google</option>
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

      <Card>
        <CardHeader>
          <CardTitle>Google</CardTitle>
          <CardDescription>Configure Google AI Studio key, model, and OpenAI-compatible base URL.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            Key: {settings.google.databaseKeyConfigured ? settings.google.databaseKeyPreview : "not set"}
            {settings.google.keyUpdatedAt && ` • Updated ${new Date(settings.google.keyUpdatedAt).toLocaleString()}`}
          </div>
          <form onSubmit={handleSaveGoogle} className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="google-key">Google API Key (optional if unchanged)</Label>
              <div className="relative">
                <Input
                  id="google-key"
                  type={showGoogleKey ? "text" : "password"}
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  autoComplete="off"
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowGoogleKey((v) => !v)}
                >
                  {showGoogleKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-model">Google Model</Label>
              <Input
                id="google-model"
                value={googleModel}
                onChange={(e) => setGoogleModel(e.target.value)}
                placeholder="gemini-2.0-flash"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-baseurl">Google Base URL</Label>
              <Input
                id="google-baseurl"
                value={googleBaseUrl}
                onChange={(e) => setGoogleBaseUrl(e.target.value)}
                placeholder="https://generativelanguage.googleapis.com/v1beta/openai/"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={saving || loadingSettings}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Google
              </Button>
              <Button type="button" variant="destructive" disabled={saving} onClick={() => clearKey("google")}>
                Clear Google Key
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Site Logo</CardTitle>
          <CardDescription>Upload the logo shown in the top navigation bar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-md border bg-muted flex items-center justify-center overflow-hidden">
              {siteSettings.logoUrl ? (
                <img src={siteSettings.logoUrl} alt="Site logo preview" className="h-full w-full object-contain" />
              ) : (
                <span className="text-xs text-muted-foreground">No Logo</span>
              )}
            </div>
            <div className="text-sm text-muted-foreground">
              Recommended: square PNG/SVG image.
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Label htmlFor="site-logo-upload" className="cursor-pointer">
              <span className="sr-only">Upload site logo</span>
              <div className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm shadow-sm">
                {logoUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Logo
                  </>
                )}
              </div>
            </Label>
            <Input
              id="site-logo-upload"
              type="file"
              accept="image/*"
              className="hidden"
              disabled={saving || logoUploading || loadingSettings}
              onChange={handleLogoUpload}
            />
            <Button
              type="button"
              variant="destructive"
              disabled={saving || logoUploading || !siteSettings.logoUrl}
              onClick={handleRemoveLogo}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Remove Logo
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Homepage Banners</CardTitle>
          <CardDescription>Upload images for the homepage sliding banner carousel (max 10).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {siteSettings.banners.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {siteSettings.banners.map((banner, index) => (
                <div key={`${banner}-${index}`} className="rounded-md border bg-muted overflow-hidden">
                  <div className="aspect-[16/9] bg-background">
                    <img src={banner} alt={`Banner ${index + 1}`} className="h-full w-full object-cover" />
                  </div>
                  <div className="p-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="w-full"
                      disabled={saving || bannersUploading}
                      onClick={() => handleRemoveBanner(index)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No custom banners uploaded. The default banners are being used.
            </div>
          )}

          <div>
            <Label htmlFor="site-banner-upload" className="cursor-pointer">
              <span className="sr-only">Upload homepage banners</span>
              <div className="inline-flex h-9 items-center rounded-md border border-input bg-background px-3 text-sm shadow-sm">
                {bannersUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload Banner Images
                  </>
                )}
              </div>
            </Label>
            <Input
              id="site-banner-upload"
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={saving || bannersUploading || loadingSettings}
              onChange={handleBannerUpload}
            />
          </div>
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
