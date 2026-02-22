import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { parsePositiveInt, resolveUserIdFromRequest } from "@/lib/server/request-user"

type HighlightRow = {
  id: string
  book_id: number
  page_number: number
  text: string
  color: string
  position: string
  user_id: string | null
  created_at: string
  updated_at: string
}

function parsePositiveIntFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value !== "string") return null
  return parsePositiveInt(value)
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parsePosition(position: string | null | undefined) {
  if (!position) return null
  try {
    return JSON.parse(position)
  } catch {
    return position
  }
}

function serializePosition(position: unknown) {
  if (typeof position === "string") return position
  return JSON.stringify(position ?? {})
}

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

function mapHighlightRow(row: HighlightRow) {
  return {
    id: row.id,
    book_id: row.book_id,
    page_number: row.page_number,
    text: row.text,
    color: row.color,
    position: parsePosition(row.position),
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function fetchHighlightById(db: any, id: string, userId: string) {
  const row = (await db
    .prepare(
      `SELECT id, book_id, page_number, text, color, position, user_id, created_at, updated_at
       FROM book_highlights
       WHERE id = ? AND user_id = ?
       LIMIT 1`
    )
    .bind(id, userId)
    .first()) as HighlightRow | null

  return row ? mapHighlightRow(row) : null
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const url = new URL(request.url)

    const bookId = parsePositiveInt(url.searchParams.get("bookId"))

    let sql = `SELECT id, book_id, page_number, text, color, position, user_id, created_at, updated_at
      FROM book_highlights
      WHERE user_id = ?`
    const binds: unknown[] = [userId]

    if (bookId) {
      sql += " AND book_id = ?"
      binds.push(bookId)
    }

    sql += " ORDER BY page_number ASC, datetime(created_at) ASC"

    const result = (await db
      .prepare(sql)
      .bind(...binds)
      .all()) as { results?: HighlightRow[] }

    const highlights = (result.results ?? []).map(mapHighlightRow)

    return NextResponse.json({
      success: true,
      highlights,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch highlights",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    const body = (await request.json().catch(() => null)) as
      | {
          user_id?: unknown
          id?: unknown
          book_id?: unknown
          bookId?: unknown
          page_number?: unknown
          pageNumber?: unknown
          text?: unknown
          color?: unknown
          position?: unknown
        }
      | null

    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request, body.user_id)
    const id = asNullableString(body.id) ?? newId("hl")
    const bookId = parsePositiveIntFromUnknown(body.book_id ?? body.bookId)
    const pageNumber = parsePositiveIntFromUnknown(body.page_number ?? body.pageNumber)
    const text = asNullableString(body.text)
    const color = asNullableString(body.color) ?? "#fef08a"
    const position = serializePosition(body.position)

    if (!bookId || !pageNumber || !text) {
      return NextResponse.json({ success: false, error: "book_id, page_number, and text are required" }, { status: 400 })
    }

    await db
      .prepare(
        `INSERT INTO book_highlights
          (id, book_id, page_number, text, color, position, user_id)
        VALUES
          (?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, bookId, pageNumber, text, color, position, userId)
      .run()

    const highlight = await fetchHighlightById(db, id, userId)
    if (!highlight) {
      return NextResponse.json({ success: false, error: "Created highlight but failed to load it" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      highlight,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create highlight",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

