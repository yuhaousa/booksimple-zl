import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Try to register
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    })
    
    return NextResponse.json({
      success: !error,
      error: error?.message,
      message: error ? error.message : 'Registration successful! Check your email for confirmation.',
      user: data?.user ? {
        id: data.user.id,
        email: data.user.email,
        confirmed: !!data.user.email_confirmed_at
      } : null
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    })
  }
}