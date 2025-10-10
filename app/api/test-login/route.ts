import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey || 
        supabaseUrl.includes('placeholder') || supabaseAnonKey === 'placeholder-key') {
      return NextResponse.json({
        success: false,
        error: 'Supabase configuration not available'
      })
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Try to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    
    return NextResponse.json({
      success: !error,
      error: error?.message,
      user: data?.user ? {
        id: data.user.id,
        email: data.user.email,
        confirmed: !!data.user.email_confirmed_at,
        created: data.user.created_at
      } : null
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}
