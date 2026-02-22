import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { parsePositiveInt, resolveUserIdFromRequest } from "@/lib/server/request-user"

function parseJsonValue(value: unknown) {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function normalizeAnalysisRow(row: Record<string, unknown>) {
  return {
    ...row,
    key_themes: parseJsonValue(row.key_themes),
    main_characters: parseJsonValue(row.main_characters),
    content_analysis: parseJsonValue(row.content_analysis),
    mind_map_data: parseJsonValue(row.mind_map_data),
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const url = new URL(request.url)
    const bookId = parsePositiveInt(url.searchParams.get("bookId"))
    if (!bookId) {
      return NextResponse.json({ success: false, error: "bookId is required" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request)
    let row: Record<string, unknown> | null = null

    if (userId !== "anonymous") {
      row = (await db
        .prepare(
          `SELECT *
           FROM ai_book_analysis
           WHERE book_id = ? AND user_id = ?
           ORDER BY datetime(last_accessed_at) DESC, datetime(created_at) DESC
           LIMIT 1`
        )
        .bind(bookId, userId)
        .first()) as Record<string, unknown> | null
    }

    if (!row) {
      row = (await db
        .prepare(
          `SELECT *
           FROM ai_book_analysis
           WHERE book_id = ?
           ORDER BY datetime(last_accessed_at) DESC, datetime(created_at) DESC
           LIMIT 1`
        )
        .bind(bookId)
        .first()) as Record<string, unknown> | null
    }

    return NextResponse.json({
      success: true,
      analysis: row ? normalizeAnalysisRow(row) : null,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch AI analysis",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

