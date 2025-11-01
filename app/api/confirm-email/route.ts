import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const email = searchParams.get('email')
    
    if (!token || !email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?error=invalid_confirmation_link`
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseServiceKey) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?error=server_configuration`
      )
    }
    
    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    // Get the user
    const { data: users, error: getUserError } = await supabase.auth.admin.listUsers()
    
    if (getUserError) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?error=user_not_found`
      )
    }
    
    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?error=user_not_found`
      )
    }
    
    // Check if already confirmed
    if (user.email_confirmed_at) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?confirmed=already`
      )
    }
    
    // Verify token
    const storedToken = user.user_metadata?.confirmation_token
    const expiresAt = user.user_metadata?.confirmation_expires
    
    if (!storedToken || storedToken !== token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?error=invalid_token`
      )
    }
    
    // Check if token expired
    if (expiresAt && new Date(expiresAt) < new Date()) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?error=token_expired`
      )
    }
    
    // Confirm the user's email
    const { error: confirmError } = await supabase.auth.admin.updateUserById(
      user.id,
      {
        email_confirm: true,
        user_metadata: {
          ...user.user_metadata,
          confirmation_token: null,
          confirmation_expires: null,
          email_confirmed_manually: true,
          confirmed_at: new Date().toISOString()
        }
      }
    )
    
    if (confirmError) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?error=confirmation_failed`
      )
    }
    
    // Success! Redirect to login with success message
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?confirmed=true`
    )
  } catch (error) {
    console.error('Confirm email error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/login?error=confirmation_failed`
    )
  }
}
