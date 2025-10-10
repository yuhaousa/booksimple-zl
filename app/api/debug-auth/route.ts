import { NextResponse } from 'next/server'
import { createBrowserClient } from '@supabase/ssr'

export async function GET() {
  try {
    // Check environment variables first
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    // Return early if environment variables are missing or are placeholders
    if (!supabaseUrl || !supabaseAnonKey || 
        supabaseUrl.includes('placeholder') || supabaseAnonKey === 'placeholder-key') {
      return NextResponse.json({
        connection: 'no-config',
        error: 'Environment variables not configured',
        envCheck: {
          hasUrl: !!supabaseUrl && !supabaseUrl.includes('placeholder'),
          hasKey: !!supabaseAnonKey && supabaseAnonKey !== 'placeholder-key',
          urlStartsWith: supabaseUrl?.substring(0, 30),
        }
      })
    }
    
    // Create client directly with safe parameters
    const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
    
    // Test basic connection
    const { data, error } = await supabase.from('Booklist').select('count').limit(1)
    
    return NextResponse.json({
      connection: error ? 'failed' : 'success',
      error: error?.message,
      envCheck: {
        hasUrl: true,
        hasKey: true,
        urlStartsWith: supabaseUrl.substring(0, 30),
      }
    })
  } catch (error: any) {
    return NextResponse.json({
      connection: 'failed',
      error: error.message,
      type: 'client_error'
    })
  }
}