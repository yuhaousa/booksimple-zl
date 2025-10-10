import { createBrowserClient, createServerClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

export function createClient() {
  if (typeof window !== 'undefined') {
    // Browser environment - log if using placeholders
    if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-key') {
      console.warn('Supabase environment variables not found, using placeholders')
    }
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export function createServerSupabaseClient(cookieStore?: any) {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: cookieStore ? {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: any[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    } : {
      getAll() {
        return []
      },
      setAll() {},
    },
  })
}

export const supabase = createClient()

export type Book = {
  id: number
  created_at: string
  title: string | null
  description: string | null
  author: string | null
  publisher: string | null
  isbn: string | null
  tags: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  user_id: number
}
