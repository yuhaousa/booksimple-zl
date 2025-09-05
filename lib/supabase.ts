import { createBrowserClient, createServerClient } from "@supabase/ssr"

const supabaseUrl = "https://hbqurajgjhmdpgjuvdcy.supabase.co"
const supabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicXVyYWpnamhtZHBnanV2ZGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDgyODIsImV4cCI6MjA3MjEyNDI4Mn0.80L5XZxrl_gg87Epm1gLRGfvU1s1AcwVk5gKyJOALdQ"

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
}
