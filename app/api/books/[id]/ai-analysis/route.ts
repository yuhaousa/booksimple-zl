import { NextRequest, NextResponse } from 'next/server'
import { analyzeBookWithAI, BookContent } from '@/lib/ai-book-analysis'
import { extractTextFromBookPDF } from '@/lib/pdf-extraction'
import { supabase } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params
    const bookId = resolvedParams.id

    console.log('Starting AI analysis for book ID:', bookId)

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

    // Check if we have an OpenAI API key
    if (!process.env.OPENAI_API_KEY) {
      console.warn('No OpenAI API key configured, using fallback analysis')
      return NextResponse.json(
        { error: 'AI analysis not configured. Please set OPENAI_API_KEY environment variable.' },
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

    // Perform AI analysis
    const analysis = await analyzeBookWithAI(bookContent)

    console.log('AI analysis completed successfully')

    // Return the analysis
    return NextResponse.json({
      success: true,
      analysis,
      bookInfo: {
        title: book.title,
        author: book.author,
        cover_url: book.cover_url
      }
    })

  } catch (error) {
    console.error('Error in AI analysis API:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze book with AI',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
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

    // In a full implementation, you might cache AI analysis results
    // For now, we'll redirect to POST method
    return NextResponse.json({
      message: 'Use POST method to generate AI analysis',
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