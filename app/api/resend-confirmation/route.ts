import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()
    
    if (!email) {
      return NextResponse.json({
        success: false,
        error: 'Email is required'
      }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey) {
      return NextResponse.json({
        success: false,
        error: 'Service role key not configured'
      }, { status: 500 })
    }
    
    // Create admin client to resend confirmation email
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Get the user first to check if they exist
    const { data: users, error: getUserError } = await supabase.auth.admin.listUsers()
    
    if (getUserError) {
      return NextResponse.json({
        success: false,
        error: getUserError.message,
      }, { status: 500 })
    }
    
    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found with this email',
      }, { status: 404 })
    }
    
    // Generate magic link for email confirmation
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: email,
    })
    
    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message,
        code: (error as any).code,
        recommendation: error.message.includes('rate limit') 
          ? 'Rate limit still active. Try: 1) Wait longer, 2) Delete test users, 3) Disable email confirmation temporarily'
          : 'Check Supabase logs for details'
      }, { status: 429 })
    }
    
    return NextResponse.json({
      success: true,
      message: '✅ Confirmation link generated',
      confirmationLink: data.properties.action_link,
      note: 'You can use this link directly to confirm the email, or send it to the user',
      expiresIn: '24 hours'
    })
  } catch (error) {
    console.error('Resend confirmation error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}
