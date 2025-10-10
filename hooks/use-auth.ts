"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"
import type { User } from "@supabase/supabase-js"

export function useAuth(requireAuth: boolean = false) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setUser(session?.user || null)
        
        if (requireAuth && !session?.user) {
          router.push('/login')
          return
        }
      } catch (error) {
        console.error('Error getting session:', error)
        if (requireAuth) {
          router.push('/login')
        }
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user || null)
        
        if (requireAuth && !session?.user && event !== 'INITIAL_SESSION') {
          router.push('/login')
        }
        
        if (event === 'SIGNED_OUT') {
          setUser(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase.auth, router, requireAuth])

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  return {
    user,
    loading,
    signOut,
    isAuthenticated: !!user
  }
}