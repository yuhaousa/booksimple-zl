import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!supabaseUrl || !serviceRoleKey || 
        supabaseUrl.includes('placeholder') || serviceRoleKey === 'placeholder-key') {
      return NextResponse.json({
        error: 'Supabase configuration not available',
        hasServiceKey: !!serviceRoleKey && serviceRoleKey !== 'placeholder-key'
      })
    }
    
    // Use service role to check if user exists
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers()
    
    if (error) {
      return NextResponse.json({ error: error.message })
    }
    
    const targetUser = users.users.find(user => user.email === 'yuhao@bamboosys.com')
    
    return NextResponse.json({
      userExists: !!targetUser,
      userInfo: targetUser ? {
        id: targetUser.id,
        email: targetUser.email,
        emailConfirmed: !!targetUser.email_confirmed_at,
        createdAt: targetUser.created_at,
        lastSignIn: targetUser.last_sign_in_at,
        appMetadata: targetUser.app_metadata,
        userMetadata: targetUser.user_metadata
      } : null,
      totalUsers: users.users.length
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    })
  }
}