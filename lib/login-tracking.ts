import { supabase } from "./supabase"

// Function to record login events for tracking
export const recordUserLogin = async (userId: string) => {
  try {
    // Get client information
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : ''
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Try to call the database function if it exists
    const { error } = await supabase.rpc('record_login', {
      p_user_id: userId,
      p_user_agent: userAgent,
      p_session_id: sessionId
    })
    
    if (error) {
      console.warn('Could not record login in tracking table:', error)
      // Fallback: try direct insert into login_tracking table
      const { error: insertError } = await supabase
        .from('login_tracking')
        .insert([{
          user_id: userId,
          user_agent: userAgent,
          session_id: sessionId,
          login_timestamp: new Date().toISOString()
        }])
      
      if (insertError) {
        console.warn('Could not insert login record directly:', insertError)
      }
    }
  } catch (error) {
    console.warn('Error recording login:', error)
    // Don't throw error - login tracking shouldn't break the login process
  }
}

// Function to get user login statistics
export const getUserLoginStats = async (userId: string) => {
  try {
    const { data, error } = await supabase
      .from('user_login_stats')
      .select('*')
      .eq('user_id', userId)
      .single()
    
    if (error) {
      console.warn('Could not fetch login stats:', error)
      return null
    }
    
    return data
  } catch (error) {
    console.warn('Error fetching login stats:', error)
    return null
  }
}

// Function to get all users with login statistics (for admin)
export const getAllUsersWithLoginStats = async () => {
  try {
    const { data, error } = await supabase
      .from('user_login_stats')
      .select('*')
      .order('last_login_at', { ascending: false })
    
    if (error) {
      console.warn('Could not fetch all user login stats:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.warn('Error fetching all user login stats:', error)
    return []
  }
}
