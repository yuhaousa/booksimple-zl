import { supabase } from "./supabase"

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
    
    // Try to call the database function if it exists
    const { error } = await supabase.rpc('record_book_click', {
      p_book_id: bookId,
      p_user_id: userId || null,
      p_click_type: clickType,
      p_user_agent: userAgent
    })
    
    if (error) {
      console.warn('Could not record book click in tracking table:', error)
      // Fallback: try direct insert into book_clicks table
      const { error: insertError } = await supabase
        .from('book_clicks')
        .insert([{
          book_id: bookId,
          user_id: userId || null,
          click_type: clickType,
          user_agent: userAgent,
          clicked_at: new Date().toISOString()
        }])
      
      if (insertError) {
        console.warn('Could not insert book click record directly:', insertError)
        // Still record it locally for demonstration
        console.log('Mock recording click:', { bookId, clickType, userId })
      } else {
        console.log('Book click recorded via direct insert')
      }
    } else {
      console.log('Book click recorded via function call')
    }
  } catch (error) {
    console.warn('Error recording book click:', error)
    // Don't throw error - click tracking shouldn't break the app
  }
}

// Function to get book click statistics
export const getBookClickStats = async () => {
  try {
    const { data, error } = await supabase
      .from('book_click_stats')
      .select('*')
      .order('total_clicks', { ascending: false })
    
    if (error) {
      console.warn('Could not fetch book click stats:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.warn('Error fetching book click stats:', error)
    return []
  }
}

// Function to get latest books
export const getLatestBooks = async (limit: number = 5) => {
  try {
    const { data, error } = await supabase
      .from('Booklist')
      .select(`
        id,
        title,
        author,
        created_at,
        cover_url
      `)
      .order('created_at', { ascending: false })
      .limit(limit)
    
    if (error) {
      console.warn('Could not fetch latest books:', error)
      return []
    }
    
    return data || []
  } catch (error) {
    console.warn('Error fetching latest books:', error)
    return []
  }
}
