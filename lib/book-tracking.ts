// Function to record book clicks
export const recordBookClick = async (
  bookId: number, 
  clickType: 'read' | 'download', 
  userId?: string
) => {
  try {
    console.log('Recording book click:', { bookId, clickType, userId })
    
    // Get client information
    const userAgent = typeof window !== 'undefined' ? window.navigator.userAgent : ''

    const response = await fetch('/api/book-clicks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(userId ? { 'x-user-id': userId } : {}),
      },
      body: JSON.stringify({
        book_id: bookId,
        click_type: clickType,
        user_agent: userAgent,
        user_id: userId || null,
      }),
    })
    const result = await response.json().catch(() => null)

    if (!response.ok || !result?.success) {
      console.warn('Could not record book click:', result)
      return
    }

    console.log('Book click recorded successfully')
  } catch (error) {
    console.warn('Error recording book click:', error)
    // Don't throw error - click tracking shouldn't break the app
  }
}

// Function to get book click statistics
export const getBookClickStats = async () => {
  try {
    const response = await fetch('/api/book-clicks?mode=stats', { cache: 'no-store' })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      console.warn('Could not fetch book click stats:', result)
      return []
    }

    return result.stats || []
  } catch (error) {
    console.warn('Error fetching book click stats:', error)
    return []
  }
}

// Function to get latest books
export const getLatestBooks = async (limit: number = 5) => {
  try {
    const safeLimit = Math.max(1, Math.min(limit, 50))
    const response = await fetch(`/api/books?page=1&pageSize=${safeLimit}`, { cache: 'no-store' })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      console.warn('Could not fetch latest books:', result)
      return []
    }

    return result.books || []
  } catch (error) {
    console.warn('Error fetching latest books:', error)
    return []
  }
}
