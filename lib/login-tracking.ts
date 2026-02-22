// Function to record login events for tracking
export const recordUserLogin = async (userId: string) => {
  try {
    // Get client information
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : ''
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    const response = await fetch('/api/login-tracking', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId,
      },
      body: JSON.stringify({
        user_id: userId,
        user_agent: userAgent,
        session_id: sessionId,
      }),
    })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      console.warn('Could not record login:', result)
    }
  } catch (error) {
    console.warn('Error recording login:', error)
    // Don't throw error - login tracking shouldn't break the login process
  }
}

// Function to get user login statistics
export const getUserLoginStats = async (userId: string) => {
  try {
    const response = await fetch(`/api/login-tracking?userId=${encodeURIComponent(userId)}`, { cache: 'no-store' })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      console.warn('Could not fetch login stats:', result)
      return null
    }

    return result.stats || null
  } catch (error) {
    console.warn('Error fetching login stats:', error)
    return null
  }
}

// Function to get all users with login statistics (for admin)
export const getAllUsersWithLoginStats = async () => {
  try {
    const response = await fetch('/api/login-tracking', { cache: 'no-store' })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      console.warn('Could not fetch all user login stats:', result)
      return []
    }

    return result.stats || []
  } catch (error) {
    console.warn('Error fetching all user login stats:', error)
    return []
  }
}
