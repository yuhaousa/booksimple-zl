import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveUserIdFromRequest } from "@/lib/server/request-user"

function parseId(raw: string) {
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

function parseJson(value: string | null | undefined) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const { id: rawId } = await params
    const bookId = parseId(rawId)
    if (!bookId) {
      return NextResponse.json({ success: false, error: "Invalid book id" }, { status: 400 })
    }

    const highlightsResult = (await db
      .prepare(
        `SELECT
          id, book_id, page_number, text, color, position, user_id, created_at, updated_at
        FROM book_highlights
        WHERE user_id = ? AND book_id = ?
        ORDER BY page_number ASC, datetime(created_at) ASC`
      )
      .bind(userId, bookId)
      .all()) as {
      results?: Array<{
        id: string
        book_id: number
        page_number: number
        text: string
        color: string
        position: string
        user_id: string | null
        created_at: string
        updated_at: string
      }>
    }

    const notesResult = (await db
      .prepare(
        `SELECT
          id, book_id, page_number, content, position, user_id, created_at, updated_at
        FROM book_notes
        WHERE user_id = ? AND book_id = ?
        ORDER BY page_number ASC, datetime(created_at) DESC`
      )
      .bind(userId, bookId)
      .all()) as {
      results?: Array<{
        id: string
        book_id: number
        page_number: number
        content: string
        position: string
        user_id: string | null
        created_at: string
        updated_at: string
      }>
    }

    const customOutlineResult = (await db
      .prepare(
        `SELECT
          id, book_id, title, page_number, parent_id, sort_order, original_pdf_index, user_id, created_at, updated_at
        FROM custom_outline
        WHERE user_id = ? AND book_id = ?
        ORDER BY sort_order ASC, datetime(created_at) ASC`
      )
      .bind(userId, bookId)
      .all()) as {
      results?: Array<{
        id: string
        book_id: number
        title: string
        page_number: number
        parent_id: string | null
        sort_order: number
        original_pdf_index: number | null
        user_id: string | null
        created_at: string
        updated_at: string
      }>
    }

    const highlights = (highlightsResult.results ?? []).map((item) => ({
      ...item,
      position: parseJson(item.position),
    }))
    const notes = (notesResult.results ?? []).map((item) => ({
      ...item,
      position: parseJson(item.position),
    }))
    const customOutlines = customOutlineResult.results ?? []

    return NextResponse.json({
      success: true,
      highlights,
      notes,
      customOutlines,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch reader data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

