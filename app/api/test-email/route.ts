import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    
    // Test email by attempting to register a test user with random subdomain to avoid rate limits
    const randomId = Math.random().toString(36).substring(7)
    const testEmail = `test-${Date.now()}-${randomId}@test-${randomId}.com`
    const testPassword = 'TestPassword123!'
    
    const { data, error } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
      options: {
        data: {
          display_name: 'Test User',
        },
      },
    })
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        errorDetails: {
          code: (error as any).code,
          status: (error as any).status,
          name: error.name,
        },
        details: 'Email confirmation test failed',
        troubleshooting: {
          step1: 'Check SMTP settings in Supabase dashboard',
          step2: 'Verify Resend API key is correct',
          step3: 'Try port 587 instead of 465',
          step4: 'Wait 2-3 minutes after saving SMTP settings',
          step5: 'Check Resend dashboard for any failed emails',
        }
      }, { status: 500 })
    }
    
    // Check the response to see if confirmation is required
    const requiresConfirmation = data.user && !data.session
    
    return NextResponse.json({
      success: true,
      testEmail,
      requiresConfirmation,
      userCreated: !!data.user,
      sessionCreated: !!data.session,
      message: requiresConfirmation 
        ? '✅ Email confirmation is ENABLED. User must check email to verify account.'
        : '⚠️ Email confirmation is DISABLED. User is auto-confirmed and logged in.',
      userId: data.user?.id,
      emailConfirmed: data.user?.email_confirmed_at ? true : false,
      userDetails: {
        email: data.user?.email,
        created_at: data.user?.created_at,
        confirmed_at: data.user?.email_confirmed_at,
      }
    })
  } catch (error) {
    console.error('Email test error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
