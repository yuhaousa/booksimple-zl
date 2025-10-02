import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = "https://hbqurajgjhmdpgjuvdcy.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicXVyYWpnamhtZHBnanV2ZGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDgyODIsImV4cCI6MjA3MjEyNDI4Mn0.80L5XZxrl_gg87Epm1gLRGfvU1s1AcwVk5gKyJOALdQ"

async function createServerSupabaseClient() {
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

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()
    
    return NextResponse.json({
      success: true,
      user: user ? {
        id: user.id,
        email: user.email,
        authenticated: true
      } : null,
      error: error?.message || null,
      cookies: allCookies.map(cookie => ({
        name: cookie.name,
        hasValue: !!cookie.value,
        length: cookie.value?.length || 0
      }))
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}