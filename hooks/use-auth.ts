"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export type AuthUser = {
  id: string
  email: string | null
  display_name: string | null
}

export function useAuth(requireAuth: boolean = false) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" })
      const result = await response.json().catch(() => null)
      const nextUser = result?.success ? ((result.user ?? null) as AuthUser | null) : null
      setUser(nextUser)

      if (requireAuth && !nextUser) {
        router.push("/login")
      }
    } catch (error) {
      console.error("Error getting session:", error)
      setUser(null)
      if (requireAuth) {
        router.push("/login")
      }
    } finally {
      setLoading(false)
    }
  }, [requireAuth, router])

  useEffect(() => {
    void refresh()

    const onAuthChanged = () => {
      void refresh()
    }
    window.addEventListener("auth:changed", onAuthChanged)

    return () => {
      window.removeEventListener("auth:changed", onAuthChanged)
    }
  }, [refresh])

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      setUser(null)
      window.dispatchEvent(new Event("auth:changed"))
      router.push("/login")
      router.refresh()
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return {
    user,
    loading,
    signOut,
    refresh,
    isAuthenticated: !!user,
  }
}
