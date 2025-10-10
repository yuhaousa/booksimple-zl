import { createBrowserClient, createServerClient } from "@supabase/ssr"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export function createClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export function createServerSupabaseClient() {
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
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
