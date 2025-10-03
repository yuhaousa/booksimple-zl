import { NextRequest, NextResponse } from 'next/server'
import { analyzeBookWithAI, BookContent } from '@/lib/ai-book-analysis'
import { extractTextFromBookPDF } from '@/lib/pdf-extraction'
import { createServerClient } from '@supabase/ssr'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'

const supabaseUrl = "https://hbqurajgjhmdpgjuvdcy.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicXVyYWpnamhtZHBnanV2ZGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDgyODIsImV4cCI6MjA3MjEyNDI4Mn0.80L5XZxrl_gg87Epm1gLRGfvU1s1AcwVk5gKyJOALdQ"

async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options)
        })
      },
    },
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const bookId = resolvedParams.id

    console.log('Starting AI analysis for book ID:', bookId)

    // Create server-side Supabase client with auth
    const supabase = await createServerSupabaseClient()
    
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch book data from database
    const { data: book, error: bookError } = await supabase
      .from("Booklist")
      .select("*")
      .eq("id", bookId)
      .single()

    if (bookError || !book) {
      console.error('Book not found:', bookError)
      return NextResponse.json(
        { error: 'Book not found' }, 
        { status: 404 }
      )
    }

    // Calculate content hash for cache validation
    const contentToHash = `${book.title}|${book.author}|${book.description}|${book.file_url}`
    const contentHash = createHash('sha256').update(contentToHash).digest('hex')

    // Check if we already have a cached analysis for this exact content
    console.log('🔍 Checking for existing analysis before API call:', {
      bookId: parseInt(bookId),
      userId: user.id,
      contentHash: contentHash.substring(0, 8) + '...'
    })
    
    const { data: existingAnalysis, error: existingError } = await supabase
      .from('ai_book_analysis')
      .select('*')
      .eq('book_id', parseInt(bookId))
      .eq('user_id', user.id)
      .eq('content_hash', contentHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    console.log('📊 Existing analysis check:', {
      found: !!existingAnalysis,
      error: existingError?.message || 'none'
    })

    if (existingAnalysis) {
      console.log('✅ Found existing analysis, returning cached result')
      return NextResponse.json({
        success: true,
        fromCache: true,
        analysis: {
          summary: existingAnalysis.summary,
          keyPoints: existingAnalysis.key_themes || [],
          keywords: existingAnalysis.main_characters || [],
          topics: existingAnalysis.genre_analysis?.split(', ') || [],
          difficulty: existingAnalysis.reading_level,
          readingTime: existingAnalysis.reading_time_minutes,
          mindmapData: existingAnalysis.mind_map_data,
          confidence: existingAnalysis.content_analysis?.confidence || 0.8
        },
        bookInfo: {
          title: book.title,
          author: book.author,
          cover_url: book.cover_url
        }
      })
    }

    // Check if we have an OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('No OpenAI API key configured, using fallback analysis')
      return NextResponse.json(
        { 
          error: 'OpenAI API key not configured',
          details: 'AI analysis service is not available. Please configure OPENAI_API_KEY environment variable.',
          fallbackRecommended: true
        },
        { status: 503 }
      )
    }

    // Try to extract PDF text for enhanced analysis
    let pdfText: string | undefined
    let pageCount: number | undefined
    
    try {
      console.log('Attempting PDF text extraction...')
      const pdfExtraction = await extractTextFromBookPDF(parseInt(bookId))
      if (pdfExtraction && pdfExtraction.text) {
        pdfText = pdfExtraction.text.slice(0, 8000) // Limit for AI processing
        pageCount = pdfExtraction.pageCount
        console.log(`Extracted ${pdfText.length} characters from PDF (${pageCount} pages)`)
      }
    } catch (error) {
      console.warn('PDF extraction failed, using metadata only:', error)
    }

    // Prepare book content for analysis
    const bookContent: BookContent = {
      title: book.title,
      author: book.author,
      description: book.description,
      tags: book.tags,
      textContent: pdfText,
      pageCount: pageCount
    }

    console.log('Sending book to AI for analysis:', bookContent.title)

    // Perform AI analysis with timeout protection
    let analysis: any
    try {
      // Add a timeout wrapper for the AI analysis
      const analysisPromise = analyzeBookWithAI(bookContent)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI analysis timeout')), 30000) // 30 second timeout
      })
      
      analysis = await Promise.race([analysisPromise, timeoutPromise]) as any
      console.log('AI analysis completed successfully, caching result...')
    } catch (aiError) {
      console.error('AI analysis failed:', aiError)
      
      // Return structured error response
      return NextResponse.json(
        { 
          success: false,
          error: 'AI analysis failed',
          details: aiError instanceof Error ? aiError.message : 'AI processing error',
          fallbackRecommended: true,
          timestamp: new Date().toISOString()
        }, 
        { status: 500 }
      )
    }

    // Cache the analysis result in database
    try {
      console.log('Attempting to cache analysis for user:', user.id, 'book:', bookId)
      const cacheData = {
        book_id: parseInt(bookId),
        user_id: user.id,
        summary: analysis.summary,
        key_themes: analysis.keyPoints || [],
        main_characters: analysis.keywords || [],
        genre_analysis: analysis.topics?.join(', ') || '',
        reading_level: analysis.difficulty,
        page_count_estimate: pageCount || Math.ceil(analysis.readingTime * 200 / 300), // Estimate from reading time
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

      const { data: cachedResult, error: cacheError } = await supabase
        .from('ai_book_analysis')
        .insert(cacheData)
        .select()
        .single()

      if (cacheError) {
        console.error('Failed to cache analysis - Supabase error:', cacheError)
        console.error('Cache data structure:', JSON.stringify(cacheData, null, 2))
        // Continue anyway, just log the warning
      } else {
        console.log('✅ Analysis cached successfully with ID:', cachedResult.id)
      }
    } catch (cacheError) {
      console.error('❌ Error caching analysis - Exception:', cacheError)
      // Continue anyway
    }

    // Return the analysis
    return NextResponse.json({
      success: true,
      fromCache: false,
      analysis,
      bookInfo: {
        title: book.title,
        author: book.author,
        cover_url: book.cover_url
      }
    })

  } catch (error) {
    console.error('Error in AI analysis API:', error)
    
    // Provide specific error messages based on error type
    let errorMessage = 'Failed to analyze book with AI'
    let details = 'Unknown error'
    
    if (error instanceof Error) {
      details = error.message
      if (error.message.includes('API key')) {
        errorMessage = 'OpenAI API configuration error'
      } else if (error.message.includes('rate limit') || error.message.includes('quota')) {
        errorMessage = 'OpenAI API rate limit exceeded'
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorMessage = 'Network error connecting to AI service'
      } else if (error.message.includes('timeout')) {
        errorMessage = 'AI service request timed out'
      } else if (error.message.includes('JSON')) {
        errorMessage = 'AI service returned invalid response'
      }
    }
    
    // Ensure we always return valid JSON
    try {
      return NextResponse.json(
        { 
          success: false,
          error: errorMessage,
          details: details,
          fallbackRecommended: true,
          timestamp: new Date().toISOString()
        }, 
        { 
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
    } catch (responseError) {
      // Absolute fallback if NextResponse.json fails
      console.error('Failed to create JSON response:', responseError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Internal server error',
          details: 'Failed to process AI analysis request',
          fallbackRecommended: true
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
          }
        }
      )
    }
  }
}

// Handle GET requests for cached analysis
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const bookId = resolvedParams.id

    // Create server-side Supabase client with auth
    const supabase = await createServerSupabaseClient()

    // Get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // First, fetch the book to get its content for hash calculation
    const { data: book, error: bookError } = await supabase
      .from("Booklist")
      .select("*")
      .eq("id", bookId)
      .single()

    if (bookError || !book) {
      return NextResponse.json({ error: 'Book not found' }, { status: 404 })
    }

    // Calculate content hash for cache validation
    const contentToHash = `${book.title}|${book.author}|${book.description}|${book.file_url}`
    const contentHash = createHash('sha256').update(contentToHash).digest('hex')
    
    console.log('🔍 Looking for cached analysis:', {
      bookId: parseInt(bookId),
      userId: user.id,
      contentHash: contentHash.substring(0, 8) + '...'
    })

    // Try to get cached analysis
    const { data: cachedAnalysis, error: cacheError } = await supabase
      .from('ai_book_analysis')
      .select('*')
      .eq('book_id', parseInt(bookId))
      .eq('user_id', user.id)
      .eq('content_hash', contentHash)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    
    console.log('📊 Cache lookup result:', {
      found: !!cachedAnalysis,
      error: cacheError?.message || 'none'
    })

    if (cachedAnalysis && !cacheError) {
      // Update last accessed timestamp
      await supabase.rpc('touch_ai_analysis_access', {
        analysis_id: cachedAnalysis.id
      })

      console.log('Returning cached AI analysis for book:', bookId)
      
      return NextResponse.json({
        success: true,
        fromCache: true,
        analysis: {
          summary: cachedAnalysis.summary,
          keyPoints: cachedAnalysis.key_themes || [],
          keywords: cachedAnalysis.main_characters || [],
          topics: cachedAnalysis.genre_analysis?.split(', ') || [],
          difficulty: cachedAnalysis.reading_level,
          readingTime: cachedAnalysis.reading_time_minutes,
          mindmapData: cachedAnalysis.mind_map_data,
          confidence: cachedAnalysis.content_analysis?.confidence || 0.8
        },
        bookInfo: {
          title: book.title,
          author: book.author,
          cover_url: book.cover_url
        },
        cacheInfo: {
          createdAt: cachedAnalysis.created_at,
          lastAccessedAt: cachedAnalysis.last_accessed_at,
          analysisVersion: cachedAnalysis.analysis_version,
          aiModel: cachedAnalysis.ai_model_used
        }
      })
    }

    // No cached analysis found
    return NextResponse.json({
      success: false,
      fromCache: false,
      message: 'No cached analysis found. Use POST method to generate new analysis.',
      analysisEndpoint: `/api/books/${bookId}/ai-analysis`
    })

  } catch (error) {
    console.error('Error in AI analysis GET:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve analysis' },
      { status: 500 }
    )
  }
}
