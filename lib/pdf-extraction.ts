import { getR2Bucket, requireD1Database } from "@/lib/server/cloudflare-bindings"
import { extractAssetKey, toAssetUrl } from "@/lib/server/storage"

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

function extractLikelyPdfText(pdfBytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(pdfBytes)

  const directTextMatches = Array.from(raw.matchAll(/\(([^()\\]|\\.){2,500}\)\s*Tj/g))
    .map((match) => match[0])
    .join(" ")

  const arrayTextMatches = Array.from(raw.matchAll(/\[([\s\S]*?)\]\s*TJ/g))
    .map((match) => match[1])
    .join(" ")

  const inlineLiterals = `${directTextMatches} ${arrayTextMatches}`
    .replace(/[()[\]]/g, " ")
    .replace(/\\[nrtbf()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (inlineLiterals.length > 200) {
    return inlineLiterals
  }

  return raw
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u4E00-\u9FFF\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function estimatePageCount(pdfBytes: Uint8Array): number {
  const raw = new TextDecoder("latin1").decode(pdfBytes)
  const pageMatches = raw.match(/\/Type\s*\/Page\b/g) || raw.match(/\/Page\b/g) || []
  return pageMatches.length > 0 ? pageMatches.length : 0
}

function getCandidateKeys(rawKey: string) {
  if (rawKey.includes("/")) return [rawKey]

  const lower = rawKey.toLowerCase()
  if (lower.endsWith(".pdf")) {
    return [rawKey, `book-file/${rawKey}`, `video-file/${rawKey}`]
  }

  return [rawKey, `book-file/${rawKey}`, `video-file/${rawKey}`]
}

function parsePdfBytes(pdfBytes: Uint8Array): PDFExtractionResult {
  return {
    text: extractLikelyPdfText(pdfBytes),
    pageCount: estimatePageCount(pdfBytes),
    metadata: {},
  }
}

async function readBytesFromR2(storedValue: string | null | undefined): Promise<Uint8Array | null> {
  const bucket = getR2Bucket()
  if (!bucket) return null

  const extractedKey = extractAssetKey(storedValue)
  if (!extractedKey) return null

  for (const candidateKey of getCandidateKeys(extractedKey)) {
    const object = await bucket.get(candidateKey)
    if (!object) continue
    const arrayBuffer = await object.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }

  return null
}

async function readBytesFromAbsoluteUrl(fileUrl: string | null): Promise<Uint8Array | null> {
  if (!fileUrl || !/^https?:\/\//i.test(fileUrl)) return null

  const response = await fetch(fileUrl)
  if (!response.ok) return null

  const arrayBuffer = await response.arrayBuffer()
  return new Uint8Array(arrayBuffer)
}

/**
 * Extract text from a publicly reachable PDF URL.
 */
export async function extractTextFromPDF(fileUrl: string): Promise<PDFExtractionResult> {
  const pdfBytes = await readBytesFromAbsoluteUrl(fileUrl)
  if (!pdfBytes) {
    throw new Error("Failed to fetch PDF bytes from URL")
  }
  return parsePdfBytes(pdfBytes)
}

/**
 * Extract text from a book's stored PDF (R2 key in D1).
 */
export async function extractTextFromBookPDF(bookId: number): Promise<PDFExtractionResult | null> {
  try {
    const db = requireD1Database()
    const book = (await db
      .prepare('SELECT file_url, title, author FROM "Booklist" WHERE id = ? LIMIT 1')
      .bind(bookId)
      .first()) as { file_url: string | null; title: string | null; author: string | null } | null

    if (!book?.file_url) return null

    let pdfBytes = await readBytesFromR2(book.file_url)
    if (!pdfBytes) {
      const maybeUrl = toAssetUrl(book.file_url)
      pdfBytes = await readBytesFromAbsoluteUrl(maybeUrl)
    }
    if (!pdfBytes) return null

    const result = parsePdfBytes(pdfBytes)
    if (!result.metadata.title && book.title) result.metadata.title = book.title
    if (!result.metadata.author && book.author) result.metadata.author = book.author
    return result
  } catch (error) {
    console.error("Error in extractTextFromBookPDF:", error)
    return null
  }
}

/**
 * Client-side extraction stub (not used in server routes).
 */
export async function extractTextFromPDFClient(_pdfUrl: string): Promise<PDFExtractionResult> {
  throw new Error("Client-side PDF extraction is not implemented")
}

export function chunkTextForAI(text: string, maxChunkSize = 4000): string[] {
  const sentences = text.split(/[.!?]+/)
  const chunks: string[] = []
  let currentChunk = ""

  for (const sentence of sentences) {
    const trimmedSentence = sentence.trim()
    if (!trimmedSentence) continue

    if (currentChunk.length + trimmedSentence.length > maxChunkSize) {
      if (currentChunk) {
        chunks.push(currentChunk.trim())
        currentChunk = ""
      }
    }

    currentChunk += `${trimmedSentence}. `
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks
}

export function extractKeyPassages(text: string, maxPassages = 5): string[] {
  const paragraphs = text.split(/\n\s*\n/)

  return paragraphs
    .filter((p) => p.trim().length > 100)
    .sort((a, b) => b.length - a.length)
    .slice(0, maxPassages)
}

