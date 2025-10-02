/**
 * PDF Text Extraction Service
 * This service provides basic PDF text extraction capabilities
 * In production, you would enhance this with more sophisticated PDF parsing
 */

import { supabase } from '@/lib/supabase'

export interface PDFExtractionResult {
  text: string
  pageCount: number
  metadata: {
    title?: string
    author?: string
    subject?: string
    keywords?: string
  }
}

/**
 * Extract text from a PDF file URL
 * Currently returns minimal extraction - in production, use libraries like:
 * - pdf-parse (Node.js)
 * - PDF.js (client-side)
 * - External APIs (Adobe PDF Services, etc.)
 */
export async function extractTextFromPDF(fileUrl: string): Promise<PDFExtractionResult> {
  try {
    console.log('Starting PDF text extraction for:', fileUrl)
    
    // For now, return a basic structure
    // In production, you would:
    // 1. Fetch the PDF file
    // 2. Parse it using a PDF library
    // 3. Extract text content and metadata
    
    // Placeholder implementation
    const result: PDFExtractionResult = {
      text: '', // Would contain extracted text
      pageCount: 0, // Would contain actual page count
      metadata: {
        title: undefined,
        author: undefined,
        subject: undefined,
        keywords: undefined
      }
    }
    
    // TODO: Implement actual PDF parsing
    console.warn('PDF text extraction not fully implemented - using placeholder')
    
    return result
    
  } catch (error) {
    console.error('Error extracting text from PDF:', error)
    throw new Error('Failed to extract text from PDF')
  }
}

/**
 * Extract text from a book's PDF file using Supabase storage
 */
export async function extractTextFromBookPDF(bookId: number): Promise<PDFExtractionResult | null> {
  try {
    // Get book file URL from database
    const { data: book, error } = await supabase
      .from("Booklist")
      .select("file_url, title, author")
      .eq("id", bookId)
      .single()
    
    if (error || !book?.file_url) {
      console.log('No PDF file found for book:', bookId)
      return null
    }
    
    // Generate signed URL for file access
    const { data: signedFile, error: signedError } = await supabase.storage
      .from("book-file")
      .createSignedUrl(book.file_url.replace(/^book-file\//, ""), 60 * 60) // 1 hour
    
    if (signedError || !signedFile?.signedUrl) {
      console.error('Failed to generate signed URL:', signedError)
      return null
    }
    
    // Extract text from the PDF
    const extractionResult = await extractTextFromPDF(signedFile.signedUrl)
    
    // Enhance with book metadata if extraction didn't get it
    if (!extractionResult.metadata.title && book.title) {
      extractionResult.metadata.title = book.title
    }
    if (!extractionResult.metadata.author && book.author) {
      extractionResult.metadata.author = book.author
    }
    
    return extractionResult
    
  } catch (error) {
    console.error('Error in extractTextFromBookPDF:', error)
    return null
  }
}

/**
 * Enhanced PDF text extraction using PDF.js (client-side)
 * This would be used in a browser environment
 */
export async function extractTextFromPDFClient(pdfUrl: string): Promise<PDFExtractionResult> {
  try {
    // This would use PDF.js to extract text on the client side
    // Example implementation would be:
    /*
    const pdfjsLib = require('pdfjs-dist')
    const pdf = await pdfjsLib.getDocument(pdfUrl).promise
    
    let fullText = ''
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map(item => item.str).join(' ')
      fullText += pageText + '\n'
    }
    
    return {
      text: fullText,
      pageCount: pdf.numPages,
      metadata: pdf.metadata || {}
    }
    */
    
    throw new Error('Client-side PDF extraction not implemented')
    
  } catch (error) {
    console.error('Error in client-side PDF extraction:', error)
    throw error
  }
}

/**
 * Utility function to chunk text for AI processing
 * AI APIs have token limits, so large texts need to be chunked
 */
export function chunkTextForAI(text: string, maxChunkSize: number = 4000): string[] {
  const sentences = text.split(/[.!?]+/)
  const chunks: string[] = []
  let currentChunk = ''
  
  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue
    
    if (currentChunk.length + trimmedSentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ''
      }
    }
    
    currentChunk += trimmedSentence + '. '
  }
  
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }
  
  return chunks
}

/**
 * Extract key passages from PDF text for AI analysis
 * This helps focus AI analysis on the most important content
 */
export function extractKeyPassages(text: string, maxPassages: number = 5): string[] {
  const paragraphs = text.split(/\n\s*\n/)
  
  // Simple heuristic: longer paragraphs are often more important
  const sortedParagraphs = paragraphs
    .filter(p => p.trim().length > 100) // Filter short paragraphs
    .sort((a, b) => b.length - a.length) // Sort by length
    .slice(0, maxPassages) // Take top passages
  
  return sortedParagraphs
}