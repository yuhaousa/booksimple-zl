import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = createClient()
    
    // Test basic connection
    const { data, error } = await supabase.from('Booklist').select('count').limit(1)
    
    return NextResponse.json({
      connection: error ? 'failed' : 'success',
      error: error?.message,
      envCheck: {
        hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        urlStartsWith: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30),
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