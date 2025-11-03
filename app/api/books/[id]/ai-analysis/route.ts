import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { cookies } from 'next/headers'

// Conditionally import AI functions to avoid build-time issues
async function loadAIAnalysis() {
  try {
    const { analyzeBookWithAI } = await import('@/lib/ai-book-analysis')
    return { analyzeBookWithAI }
  } catch (error) {
    console.error('Failed to load AI analysis module:', error)
    return null
  }
}

async function loadPDFExtraction() {
  try {
    const { extractTextFromBookPDF } = await import('@/lib/pdf-extraction')
    return { extractTextFromBookPDF }
  } catch (error) {
    console.error('Failed to load PDF extraction module:', error)
    return null
  }
}

const supabaseUrl = "https://hbqurajgjhmdpgjuvdcy.supabase.co"
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhicXVyYWpnamhtZHBnanV2ZGN5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NDgyODIsImV4cCI6MjA3MjEyNDI4Mn0.80L5XZxrl_gg87Epm1gLRGfvU1s1AcwVk5gKyJOALdQ"
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Create admin client that bypasses RLS - only for server-side use!
function createAdminClient() {
  if (!supabaseServiceRoleKey) {
    console.warn('⚠️ SUPABASE_SERVICE_ROLE_KEY not found, falling back to anon key')
    return createSupabaseClient(supabaseUrl, supabaseAnonKey)
  }
  return createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

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

// Extend the route timeout for AI analysis
// Vercel Pro allows up to 60 seconds, adjust based on your plan
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const bookId = resolvedParams.id
    
    // Check if force regeneration is requested
    const { searchParams } = new URL(request.url)
    const forceRegenerate = searchParams.get('force') === 'true' || searchParams.get('forceRegenerate') === 'true'

    console.log('Starting AI analysis for book ID:', bookId, forceRegenerate ? '🔄 (FORCED REGENERATION)' : '')

    // Create server-side Supabase client with auth
    const supabase = await createServerSupabaseClient()
    
    // Get current user (temporarily bypass for testing)
    const { data: { user } } = await supabase.auth.getUser()
    const testUserId = '2f88069f-0933-4036-a060-c136abf7dbf3' // Use test user ID for development
    if (!user && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Use actual user or test user
    const currentUser = user || { id: testUserId }

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
      userId: currentUser.id,
      contentHash: contentHash.substring(0, 16) + '...',
      fullHash: contentHash
    })
    
    // Use admin client to bypass RLS for cache lookup
    const adminClient = createAdminClient()
    
    // Try the simplest possible query first - just get any analysis for this book
    let { data: existingAnalysisArray, error: existingError } = await adminClient
      .from('ai_book_analysis')
      .select('*')
      .eq('book_id', parseInt(bookId))
      .order('created_at', { ascending: false })
      .limit(1)
    
    console.log('📦 Cache query result:', { 
      count: existingAnalysisArray?.length || 0,
      error: existingError?.message || 'none',
      bookId: parseInt(bookId)
    })
    
    if (existingError) {
      console.error('❌ Supabase query error:', existingError)
    }
    
    if (existingAnalysisArray && existingAnalysisArray.length > 0) {
      console.log('✅ Found cached analysis:', {
        id: existingAnalysisArray[0].id,
        userId: existingAnalysisArray[0].user_id,
        createdAt: existingAnalysisArray[0].created_at
      })
    }
    
    const existingAnalysis = existingAnalysisArray?.[0] || null
    
    console.log('📊 Existing analysis check:', {
      found: !!existingAnalysis,
      sharedCache: existingAnalysis?.user_id !== currentUser.id,
      error: existingError?.message || 'none',
      forceRegenerate
    })

    if (existingAnalysis && !forceRegenerate) {
      console.log('✅ Found existing analysis, returning cached result')
      return NextResponse.json({
        success: true,
        fromCache: true,
        analysis: {
          summary: existingAnalysis.summary,
          detailedSummary: existingAnalysis.content_analysis?.detailedSummary,
          keyPoints: existingAnalysis.key_themes || [],
          keywords: existingAnalysis.main_characters || [],
          topics: existingAnalysis.genre_analysis?.split(', ') || [],
          difficulty: existingAnalysis.reading_level,
          readingTime: existingAnalysis.reading_time_minutes,
          mindmapData: existingAnalysis.mind_map_data,
          confidence: existingAnalysis.content_analysis?.confidence || 0.8,
          authorBackground: existingAnalysis.content_analysis?.authorBackground,
          bookBackground: existingAnalysis.content_analysis?.bookBackground,
          worldRelevance: existingAnalysis.content_analysis?.worldRelevance,
          quizQuestions: existingAnalysis.content_analysis?.quizQuestions
        },
        bookInfo: {
          title: book.title,
          author: book.author,
          cover_url: book.cover_url
        }
      })
    }

    // If force regenerate is true, delete all existing analyses for this book
    if (forceRegenerate && existingAnalysis) {
      console.log('🗑️ Deleting old cached analysis for book:', bookId)
      const { error: deleteError } = await adminClient
        .from('ai_book_analysis')
        .delete()
        .eq('book_id', parseInt(bookId))
      
      if (deleteError) {
        console.error('❌ Failed to delete old cache:', deleteError)
      } else {
        console.log('✅ Old cache deleted successfully')
      }
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

    // Load AI and PDF extraction modules
    const aiModule = await loadAIAnalysis()
    const pdfModule = await loadPDFExtraction()

    if (!aiModule) {
      console.error('AI analysis module not available')
      return NextResponse.json(
        { 
          error: 'AI analysis module not available',
          details: 'AI analysis dependencies could not be loaded',
          fallbackRecommended: true
        },
        { status: 503 }
      )
    }

    // Try to extract PDF text for enhanced analysis
    let pdfText: string | undefined
    let pageCount: number | undefined
    
    if (pdfModule) {
      try {
        console.log('Attempting PDF text extraction...')
        const pdfExtraction = await pdfModule.extractTextFromBookPDF(parseInt(bookId))
        if (pdfExtraction && pdfExtraction.text) {
          pdfText = pdfExtraction.text.slice(0, 8000) // Limit for AI processing
          pageCount = pdfExtraction.pageCount
          console.log(`Extracted ${pdfText.length} characters from PDF (${pageCount} pages)`)
        }
      } catch (error) {
        console.warn('PDF extraction failed, using metadata only:', error)
      }
    } else {
      console.warn('PDF extraction module not available, using metadata only')
    }

    // Prepare book content for analysis
    const bookContent = {
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
      const analysisPromise = aiModule.analyzeBookWithAI(bookContent)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI analysis timeout')), 120000) // 120 second timeout (2 minutes)
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
      console.log('Attempting to cache analysis for user:', currentUser.id, 'book:', bookId)
      const cacheData = {
        book_id: parseInt(bookId),
        user_id: currentUser.id,
        summary: analysis.summary,
        key_themes: analysis.keyPoints || [],
        main_characters: analysis.keywords || [],
        genre_analysis: analysis.topics?.join(', ') || '',
        reading_level: analysis.difficulty,
        page_count_estimate: pageCount || Math.ceil(analysis.readingTime * 200 / 300), // Estimate from reading time
        reading_time_minutes: analysis.readingTime,
        content_analysis: {
          detailedSummary: analysis.detailedSummary,
          keyPoints: analysis.keyPoints,
          keywords: analysis.keywords,
          topics: analysis.topics,
          confidence: analysis.confidence,
          authorBackground: analysis.authorBackground,
          bookBackground: analysis.bookBackground,
          worldRelevance: analysis.worldRelevance,
          quizQuestions: analysis.quizQuestions
        },
        mind_map_data: analysis.mindmapData || {},
        content_hash: contentHash,
        analysis_version: '1.0',
        ai_model_used: 'gpt-4'
      }

      // Use admin client to bypass RLS for cache insertion
      const adminClient = createAdminClient()
      const { data: cachedResult, error: cacheError } = await adminClient
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
      analysis: {
        ...analysis,
        authorBackground: analysis.authorBackground,
        bookBackground: analysis.bookBackground,
        worldRelevance: analysis.worldRelevance,
        quizQuestions: analysis.quizQuestions
      },
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

    // Get current user (temporarily bypass for testing)
    const { data: { user } } = await supabase.auth.getUser()
    const testUserId = '2f88069f-0933-4036-a060-c136abf7dbf3' // Use test user ID for development
    if (!user && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Use actual user or test user
    const currentUser = user || { id: testUserId }

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
      userId: currentUser.id,
      contentHash: contentHash.substring(0, 8) + '...'
    })

    // Try to get cached analysis
    const { data: cachedAnalysisArray, error: cacheError } = await supabase
      .from('ai_book_analysis')
      .select('*')
      .eq('book_id', parseInt(bookId))
      .eq('user_id', currentUser.id)
      .eq('content_hash', contentHash)
      .order('created_at', { ascending: false })
      .limit(1)
    
    const cachedAnalysis = cachedAnalysisArray?.[0] || null
    
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
          confidence: cachedAnalysis.content_analysis?.confidence || 0.8,
          authorBackground: cachedAnalysis.content_analysis?.authorBackground,
          bookBackground: cachedAnalysis.content_analysis?.bookBackground,
          worldRelevance: cachedAnalysis.content_analysis?.worldRelevance,
          quizQuestions: cachedAnalysis.content_analysis?.quizQuestions
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
