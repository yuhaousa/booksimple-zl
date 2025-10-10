import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// This API route uses service role to fetch user data
export async function GET(request: NextRequest) {
  try {
    // Use service role key for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    
    if (!serviceRoleKey) {
      // Return indication that we need service role key for real user data
      return NextResponse.json({ 
        users: null, 
        error: 'Service role key not configured - cannot fetch real user data',
        needsServiceKey: true 
      })
    }

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Fetch users using admin client
    const { data: authUsers, error } = await supabaseAdmin.auth.admin.listUsers()
    
    if (error) {
      console.error('Error fetching users:', error)
      return NextResponse.json({ users: null, error: error.message })
    }

    // Return user data (filter sensitive information if needed)
    const sanitizedUsers = authUsers.users.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      user_metadata: user.user_metadata,
      app_metadata: user.app_metadata,
      email_confirmed_at: user.email_confirmed_at,
    }))

    return NextResponse.json({ users: sanitizedUsers })
  } catch (error) {
    console.error('Admin users API error:', error)
    return NextResponse.json({ users: null, error: 'Failed to fetch users' })
  }
}
