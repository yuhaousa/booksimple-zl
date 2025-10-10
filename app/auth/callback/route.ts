import { createClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const origin = requestUrl.origin

  if (code) {
    const supabase = createClient()
    
    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error) {
      // Redirect to a success page or dashboard
      return NextResponse.redirect(`${origin}/login?confirmed=true`)
    }
  }

  // If there's an error, redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=confirmation_failed`)
}