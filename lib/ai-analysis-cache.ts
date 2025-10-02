import { supabase } from '@/lib/supabase'
import { AIBookAnalysis } from '@/lib/ai-book-analysis'
import { createHash } from 'crypto'

export interface CachedAIAnalysis {
  id: string
  book_id: number
  user_id: string
  summary: string
  key_themes: string[]
  main_characters: string[]
  genre_analysis: string
  reading_level: string
  page_count_estimate: number
  reading_time_minutes: number
  content_analysis: any
  mind_map_data: any
  content_hash: string
  analysis_version: string
  ai_model_used: string
  created_at: string
  updated_at: string
  last_accessed_at: string
}

export interface BookInfo {
  title: string
  author?: string
  description?: string
  file_url?: string
}

/**
 * Generate content hash for cache validation
 */
export function generateContentHash(bookInfo: BookInfo): string {
  const contentToHash = `${bookInfo.title}|${bookInfo.author || ''}|${bookInfo.description || ''}|${bookInfo.file_url || ''}`
  return createHash('sha256').update(contentToHash).digest('hex')
}

/**
 * Get cached AI analysis for a book
 */
export async function getCachedAnalysis(
  bookId: number, 
  userId: string, 
  contentHash: string
): Promise<CachedAIAnalysis | null> {
  try {
    const { data, error } = await supabase
      .from('ai_book_analysis')
      .select('*')
      .eq('book_id', bookId)
      .eq('user_id', userId)
      .eq('content_hash', contentHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return null
    }

    // Update last accessed timestamp
    await supabase.rpc('touch_ai_analysis_access', {
      analysis_id: data.id
    })

    return data as CachedAIAnalysis
  } catch (error) {
    console.error('Error retrieving cached analysis:', error)
    return null
  }
}

/**
 * Save AI analysis to cache
 */
export async function saveAnalysisToCache(
  bookId: number,
  userId: string,
  analysis: AIBookAnalysis,
  contentHash: string,
  pageCount?: number
): Promise<CachedAIAnalysis | null> {
  try {
    const cacheData = {
      book_id: bookId,
      user_id: userId,
      summary: analysis.summary,
      key_themes: analysis.keyPoints || [],
      main_characters: analysis.keywords || [],
      genre_analysis: analysis.topics?.join(', ') || '',
      reading_level: analysis.difficulty,
      page_count_estimate: pageCount || Math.ceil(analysis.readingTime * 200 / 300),
      reading_time_minutes: analysis.readingTime,
      content_analysis: {
        keyPoints: analysis.keyPoints,
        keywords: analysis.keywords,
        topics: analysis.topics,
        confidence: analysis.confidence
      },
      mind_map_data: analysis.mindmapData || {},
      content_hash: contentHash,
      analysis_version: '1.0',
      ai_model_used: 'gpt-4'
    }

    const { data, error } = await supabase
      .from('ai_book_analysis')
      .insert(cacheData)
      .select()
      .single()

    if (error) {
      console.error('Failed to cache analysis:', error)
      return null
    }

    return data as CachedAIAnalysis
  } catch (error) {
    console.error('Error caching analysis:', error)
    return null
  }
}

/**
 * Convert cached analysis to AIBookAnalysis format
 */
export function convertCachedToAI(cached: CachedAIAnalysis): AIBookAnalysis {
  return {
    summary: cached.summary,
    keyPoints: cached.key_themes || [],
    keywords: cached.main_characters || [],
    topics: cached.genre_analysis?.split(', ') || [],
    difficulty: cached.reading_level as "Beginner" | "Intermediate" | "Advanced",
    readingTime: cached.reading_time_minutes,
    mindmapData: cached.mind_map_data,
    confidence: cached.content_analysis?.confidence || 0.8
  }
}

/**
 * Clean up old unused analysis entries
 */
export async function cleanupOldAnalysis(daysOld: number = 90): Promise<number> {
  try {
    const { data } = await supabase.rpc('cleanup_old_ai_analysis', {
      days_old: daysOld
    })
    
    return data || 0
  } catch (error) {
    console.error('Error cleaning up old analysis:', error)
    return 0
  }
}

/**
 * Get analysis statistics for admin/monitoring
 */
export async function getAnalysisStats() {
  try {
    const { data: totalCount } = await supabase
      .from('ai_book_analysis')
      .select('id', { count: 'exact', head: true })

    const { data: recentCount } = await supabase
      .from('ai_book_analysis')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

    const { data: uniqueBooks } = await supabase
      .from('ai_book_analysis')
      .select('book_id', { count: 'exact', head: true })

    return {
      totalAnalyses: totalCount?.length || 0,
      recentAnalyses: recentCount?.length || 0,
      uniqueBooksAnalyzed: uniqueBooks?.length || 0
    }
  } catch (error) {
    console.error('Error getting analysis stats:', error)
    return {
      totalAnalyses: 0,
      recentAnalyses: 0,
      uniqueBooksAnalyzed: 0
    }
  }
}

/**
 * Delete cached analysis by ID (admin function)
 */
export async function deleteCachedAnalysis(analysisId: string, userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('ai_book_analysis')
      .delete()
      .eq('id', analysisId)
      .eq('user_id', userId)

    return !error
  } catch (error) {
    console.error('Error deleting cached analysis:', error)
    return false
  }
}
