import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveUserIdFromRequest } from "@/lib/server/request-user"
import { toAssetUrl } from "@/lib/server/storage"

type BookRow = {
  id: number
  title: string | null
  author: string | null
  publisher: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  description: string | null
  tags: string | null
  created_at: string | null
}

type Suggestion = {
  id: number
  title: string | null
  author: string | null
  publisher: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  description: string | null
  tags: string | null
  score: number
  reasons: string[]
}

function normalizeToken(value: string | null | undefined) {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function parseTags(tags: string | null | undefined) {
  if (!tags) return []
  return tags
    .split(/[,\uFF0C\u3001;|/]+/)
    .map((item) => normalizeToken(item))
    .filter((item): item is string => Boolean(item))
}

function mapSuggestion(book: BookRow, score: number, reasons: string[]): Suggestion {
  return {
    id: book.id,
    title: book.title,
    author: book.author,
    publisher: book.publisher,
    year: book.year,
    cover_url: toAssetUrl(book.cover_url),
    file_url: toAssetUrl(book.file_url),
    description: book.description,
    tags: book.tags,
    score,
    reasons,
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)

    const readingListRows = (await db
      .prepare(
        `SELECT
          b.id,
          b.title,
          b.author,
          b.publisher,
          b.year,
          b.cover_url,
          b.file_url,
          b.description,
          b.tags,
          b.created_at
        FROM reading_list_full rl
        JOIN "Booklist" b ON b.id = rl.book_id
        WHERE rl.user_id = ?`
      )
      .bind(userId)
      .all()) as { results?: BookRow[] }

    const readingBooks = readingListRows.results ?? []
    const readingBookIds = new Set(readingBooks.map((book) => Number(book.id)))

    const authorSignals = new Set(
      readingBooks
        .map((book) => normalizeToken(book.author))
        .filter((value): value is string => Boolean(value))
    )

    const tagSignals = new Map<string, number>()
    for (const book of readingBooks) {
      for (const tag of parseTags(book.tags)) {
        tagSignals.set(tag, (tagSignals.get(tag) ?? 0) + 1)
      }
    }

    const candidateRows = (await db
      .prepare(
        `SELECT
          id,
          title,
          author,
          publisher,
          year,
          cover_url,
          file_url,
          description,
          tags,
          created_at
        FROM "Booklist"
        ORDER BY datetime(created_at) DESC
        LIMIT 300`
      )
      .all()) as { results?: BookRow[] }

    const candidates = (candidateRows.results ?? []).filter((book) => !readingBookIds.has(Number(book.id)))

    const scored: Suggestion[] = []
    for (const candidate of candidates) {
      let score = 0
      const reasons: string[] = []

      const candidateAuthor = normalizeToken(candidate.author)
      if (candidateAuthor && authorSignals.has(candidateAuthor)) {
        score += 4
        reasons.push("Same author as books in your reading list")
      }

      const candidateTags = parseTags(candidate.tags)
      const matchedTags: string[] = []
      for (const tag of candidateTags) {
        if (!tagSignals.has(tag)) continue
        matchedTags.push(tag)
        score += 2
      }
      if (matchedTags.length > 0) {
        reasons.push(`Matched tags: ${matchedTags.slice(0, 3).join(", ")}`)
      }

      if (score > 0) {
        scored.push(mapSuggestion(candidate, score, reasons))
      }
    }

    scored.sort((a, b) => b.score - a.score)
    const personalized = scored.slice(0, 12)

    if (personalized.length < 12) {
      const selected = new Set(personalized.map((item) => item.id))
      for (const candidate of candidates) {
        if (selected.has(candidate.id)) continue
        personalized.push(mapSuggestion(candidate, 0, readingBooks.length ? ["Popular recent addition"] : ["Start with recent additions"]))
        selected.add(candidate.id)
        if (personalized.length >= 12) break
      }
    }

    return NextResponse.json({
      success: true,
      suggestions: personalized,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to load reading suggestions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

