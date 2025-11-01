import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function DELETE(request: NextRequest) {
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
    
    // Create admin client with service role key
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
    
    console.log('🔍 Looking for user with email:', email)
    
    // Find the user by email
    const { data: users, error: listError } = await supabase.auth.admin.listUsers()
    
    if (listError) {
      console.error('❌ Error listing users:', listError)
      return NextResponse.json({
        success: false,
        error: listError.message
      }, { status: 500 })
    }
    
    const user = users.users.find(u => u.email === email)
    
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found with this email'
      }, { status: 404 })
    }
    
    console.log('👤 Found user:', user.id, user.email)
    
    // Delete from user_list table first (if exists)
    const { error: userListError } = await supabase
      .from('user_list')
      .delete()
      .eq('auth_user_id', user.id)
    
    if (userListError) {
      console.warn('⚠️ Could not delete from user_list:', userListError.message)
    } else {
      console.log('✅ Deleted from user_list')
    }
    
    // Delete the user from auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id)
    
    if (deleteError) {
      console.error('❌ Error deleting user:', deleteError)
      return NextResponse.json({
        success: false,
        error: deleteError.message
      }, { status: 500 })
    }
    
    console.log('✅ User deleted successfully')
    
    return NextResponse.json({
      success: true,
      message: `User ${email} deleted successfully`,
      userId: user.id
    })
    
  } catch (error) {
    console.error('❌ Delete user error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
