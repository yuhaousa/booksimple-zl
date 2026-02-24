import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { getConfiguredOpenAIKey } from "@/lib/server/openai-config"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveUserIdFromRequest } from "@/lib/server/request-user"

async function loadAIAnalysis() {
  try {
    const { analyzeBookWithAI } = await import("@/lib/ai-book-analysis")
    return { analyzeBookWithAI }
  } catch (error) {
    console.error("Failed to load AI analysis module:", error)
    return null
  }
}

async function loadPDFExtraction() {
  try {
    const { extractTextFromBookPDF } = await import("@/lib/pdf-extraction")
    return { extractTextFromBookPDF }
  } catch (error) {
    console.error("Failed to load PDF extraction module:", error)
    return null
  }
}

type AnalysisRow = {
  id: string
  summary: string | null
  key_themes: string | null
  main_characters: string | null
  genre_analysis: string | null
  reading_level: string | null
  reading_time_minutes: number | null
  content_analysis: string | null
  mind_map_data: string | null
  analysis_version: string | null
  ai_model_used: string | null
  created_at: string | null
  last_accessed_at: string | null
}

type BookRow = {
  id: number
  title: string
  author: string | null
  description: string | null
  cover_url: string | null
  file_url: string | null
  tags: string | null
}

function parseId(raw: string) {
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

function parseJson<T = any>(value: string | null | undefined): T | null {
  if (!value) return null
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function asArrayOfStrings(value: unknown) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item)).filter((item) => item.trim().length > 0)
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function makeContentHash(book: BookRow) {
  const contentToHash = `${book.title}|${book.author || ""}|${book.description || ""}|${book.file_url || ""}`
  return createHash("sha256").update(contentToHash).digest("hex")
}

function isLegacyGenericSummary(summary: string | null | undefined) {
  if (!summary) return false
  const lower = summary.toLowerCase()
  if (lower.includes("stands as a comprehensive and authoritative exploration of its subject domain")) return true
  if (lower.includes("comprehensive and authoritative exploration of its subject domain")) return true
  if (summary.includes("具有重要价值的综合性著作")) return true
  if (summary.includes("其影响力远超其直接涉及的主题范围")) return true
  return false
}

function mapAnalysisRow(row: AnalysisRow) {
  const contentAnalysis = parseJson<Record<string, any>>(row.content_analysis)
  const mindMapData = parseJson<Record<string, any>>(row.mind_map_data)
  const keyThemes = asArrayOfStrings(parseJson(row.key_themes) ?? row.key_themes)
  const mainCharacters = asArrayOfStrings(parseJson(row.main_characters) ?? row.main_characters)

  return {
    summary: row.summary,
    detailedSummary: contentAnalysis?.detailedSummary,
    keyPoints: keyThemes,
    keywords: mainCharacters,
    topics: asArrayOfStrings(row.genre_analysis),
    difficulty: row.reading_level,
    readingTime: row.reading_time_minutes,
    mindmapData: mindMapData,
    confidence: contentAnalysis?.confidence || 0.8,
    authorBackground: contentAnalysis?.authorBackground,
    bookBackground: contentAnalysis?.bookBackground,
    worldRelevance: contentAnalysis?.worldRelevance,
    quizQuestions: contentAnalysis?.quizQuestions,
  }
}

async function getBookById(db: any, bookId: number) {
  return (await db
    .prepare(
      `SELECT id, title, author, description, cover_url, file_url, tags
       FROM "Booklist"
       WHERE id = ?
       LIMIT 1`
    )
    .bind(bookId)
    .first()) as BookRow | null
}

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const resolvedParams = await params
    const bookId = parseId(resolvedParams.id)
    if (!bookId) {
      return NextResponse.json({ success: false, error: "Invalid book id" }, { status: 400 })
    }

    const forceRegenerate =
      request.nextUrl.searchParams.get("force") === "true" ||
      request.nextUrl.searchParams.get("forceRegenerate") === "true"

    const userId = resolveUserIdFromRequest(request)
    const book = await getBookById(db, bookId)
    if (!book) {
      return NextResponse.json({ success: false, error: "Book not found" }, { status: 404 })
    }

    const contentHash = makeContentHash(book)

    if (!forceRegenerate) {
      const cached = (await db
        .prepare(
          `SELECT *
           FROM ai_book_analysis
           WHERE book_id = ? AND content_hash = ?
           ORDER BY datetime(last_accessed_at) DESC, datetime(created_at) DESC
           LIMIT 1`
        )
        .bind(bookId, contentHash)
        .first()) as AnalysisRow | null

      if (cached && !isLegacyGenericSummary(cached.summary)) {
        await db
          .prepare("UPDATE ai_book_analysis SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(cached.id)
          .run()

        return NextResponse.json({
          success: true,
          fromCache: true,
          analysis: mapAnalysisRow(cached),
          bookInfo: {
            title: book.title,
            author: book.author,
            cover_url: book.cover_url,
          },
        })
      }
    } else {
      await db.prepare("DELETE FROM ai_book_analysis WHERE book_id = ?").bind(bookId).run()
    }

    const configuredOpenAI = await getConfiguredOpenAIKey()
    if (!configuredOpenAI.apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "AI provider key not configured",
          details: "Configure provider keys in environment variables or Admin Settings.",
          fallbackRecommended: true,
        },
        { status: 503 }
      )
    }

    const aiModule = await loadAIAnalysis()
    if (!aiModule) {
      return NextResponse.json(
        {
          success: false,
          error: "AI analysis module not available",
          details: "AI analysis dependencies could not be loaded",
          fallbackRecommended: true,
        },
        { status: 503 }
      )
    }

    const pdfModule = await loadPDFExtraction()
    let pdfText: string | undefined
    let pageCount: number | undefined

    if (pdfModule) {
      try {
        const pdfExtraction = await pdfModule.extractTextFromBookPDF(bookId)
        if (pdfExtraction?.text) {
          pdfText = pdfExtraction.text.slice(0, 8000)
          pageCount = pdfExtraction.pageCount
        }
      } catch (error) {
        console.warn("PDF extraction failed, using metadata only:", error)
      }
    }

    const bookContent = {
      title: book.title,
      author: book.author || undefined,
      description: book.description || undefined,
      tags: book.tags || undefined,
      textContent: pdfText,
      pageCount,
    }

    const analysisPromise = aiModule.analyzeBookWithAI(bookContent)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("AI analysis timeout")), 120000)
    })
    const analysis = await Promise.race([analysisPromise, timeoutPromise])

    const now = new Date().toISOString()
    const readingTime =
      typeof analysis.readingTime === "number" && Number.isFinite(analysis.readingTime) && analysis.readingTime > 0
        ? Math.round(analysis.readingTime)
        : 1
    const pageCountEstimate =
      typeof pageCount === "number" && Number.isFinite(pageCount) && pageCount > 0
        ? Math.round(pageCount)
        : Math.max(1, Math.ceil((readingTime * 200) / 300))
    await db
      .prepare(
        `INSERT INTO ai_book_analysis
          (id, book_id, user_id, summary, key_themes, main_characters, genre_analysis, reading_level, page_count_estimate, reading_time_minutes, content_analysis, mind_map_data, content_hash, analysis_version, ai_model_used, created_at, updated_at, last_accessed_at)
         VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '1.0', ?, ?, ?, ?)
         ON CONFLICT(book_id, content_hash)
         DO UPDATE SET
          user_id = excluded.user_id,
          summary = excluded.summary,
          key_themes = excluded.key_themes,
          main_characters = excluded.main_characters,
          genre_analysis = excluded.genre_analysis,
          reading_level = excluded.reading_level,
          page_count_estimate = excluded.page_count_estimate,
          reading_time_minutes = excluded.reading_time_minutes,
          content_analysis = excluded.content_analysis,
          mind_map_data = excluded.mind_map_data,
          analysis_version = excluded.analysis_version,
          ai_model_used = excluded.ai_model_used,
          updated_at = excluded.updated_at,
          last_accessed_at = excluded.last_accessed_at`
      )
      .bind(
        makeId("ai"),
        bookId,
        userId,
        analysis.summary,
        JSON.stringify(analysis.keyPoints || []),
        JSON.stringify(analysis.keywords || []),
        (analysis.topics || []).join(", "),
        analysis.difficulty,
        pageCountEstimate,
        readingTime,
        JSON.stringify({
          detailedSummary: analysis.detailedSummary,
          keyPoints: analysis.keyPoints,
          keywords: analysis.keywords,
          topics: analysis.topics,
          confidence: analysis.confidence,
          authorBackground: analysis.authorBackground,
          bookBackground: analysis.bookBackground,
          worldRelevance: analysis.worldRelevance,
          quizQuestions: analysis.quizQuestions,
        }),
        JSON.stringify(analysis.mindmapData || {}),
        contentHash,
        `${configuredOpenAI.provider}:${configuredOpenAI.model}`,
        now,
        now,
        now
      )
      .run()

    return NextResponse.json({
      success: true,
      fromCache: false,
      analysis: {
        ...analysis,
        keyPoints: analysis.keyPoints || [],
        keywords: analysis.keywords || [],
        topics: analysis.topics || [],
      },
      bookInfo: {
        title: book.title,
        author: book.author,
        cover_url: book.cover_url,
      },
    })
  } catch (error) {
    console.error("Error in AI analysis API:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to analyze book with AI",
        details: error instanceof Error ? error.message : "Unknown error",
        fallbackRecommended: true,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const resolvedParams = await params
    const bookId = parseId(resolvedParams.id)
    if (!bookId) {
      return NextResponse.json({ success: false, error: "Invalid book id" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request)
    const book = await getBookById(db, bookId)
    if (!book) {
      return NextResponse.json({ success: false, error: "Book not found" }, { status: 404 })
    }

    const contentHash = makeContentHash(book)

    let cached = (await db
      .prepare(
        `SELECT *
         FROM ai_book_analysis
         WHERE book_id = ? AND user_id = ? AND content_hash = ?
         ORDER BY datetime(created_at) DESC
         LIMIT 1`
      )
      .bind(bookId, userId, contentHash)
      .first()) as AnalysisRow | null

    if (!cached) {
      cached = (await db
        .prepare(
          `SELECT *
           FROM ai_book_analysis
           WHERE book_id = ? AND content_hash = ?
           ORDER BY datetime(created_at) DESC
           LIMIT 1`
        )
        .bind(bookId, contentHash)
        .first()) as AnalysisRow | null
    }

    if (cached) {
      if (isLegacyGenericSummary(cached.summary)) {
        return NextResponse.json({
          success: false,
          fromCache: false,
          message: "Cached analysis is stale and will be regenerated.",
          analysisEndpoint: `/api/books/${bookId}/ai-analysis`,
        })
      }

      await db
        .prepare("UPDATE ai_book_analysis SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?")
        .bind(cached.id)
        .run()

      return NextResponse.json({
        success: true,
        fromCache: true,
        analysis: mapAnalysisRow(cached),
        bookInfo: {
          title: book.title,
          author: book.author,
          cover_url: book.cover_url,
        },
        cacheInfo: {
          createdAt: cached.created_at,
          lastAccessedAt: cached.last_accessed_at,
          analysisVersion: cached.analysis_version,
          aiModel: cached.ai_model_used,
        },
      })
    }

    return NextResponse.json({
      success: false,
      fromCache: false,
      message: "No cached analysis found. Use POST method to generate new analysis.",
      analysisEndpoint: `/api/books/${bookId}/ai-analysis`,
    })
  } catch (error) {
    console.error("Error in AI analysis GET:", error)
    return NextResponse.json(
      { success: false, error: "Failed to retrieve analysis" },
      { status: 500 }
    )
  }
}
