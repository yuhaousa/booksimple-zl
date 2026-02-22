import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { parsePositiveInt, resolveUserIdFromRequest } from "@/lib/server/request-user"

type BookNoteRow = {
  id: string
  book_id: number
  page_number: number
  content: string
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

function mapBookNoteRow(row: BookNoteRow) {
  return {
    id: row.id,
    book_id: row.book_id,
    page_number: row.page_number,
    content: row.content,
    position: parsePosition(row.position),
    user_id: row.user_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

async function fetchBookNoteById(db: any, id: string, userId: string) {
  const row = (await db
    .prepare(
      `SELECT id, book_id, page_number, content, position, user_id, created_at, updated_at
       FROM book_notes
       WHERE id = ? AND user_id = ?
       LIMIT 1`
    )
    .bind(id, userId)
    .first()) as BookNoteRow | null

  return row ? mapBookNoteRow(row) : null
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const url = new URL(request.url)
    const bookId = parsePositiveInt(url.searchParams.get("bookId"))

    let sql = `SELECT id, book_id, page_number, content, position, user_id, created_at, updated_at
      FROM book_notes
      WHERE user_id = ?`
    const binds: unknown[] = [userId]

    if (bookId) {
      sql += " AND book_id = ?"
      binds.push(bookId)
    }

    sql += " ORDER BY page_number ASC, datetime(created_at) DESC"

    const result = (await db
      .prepare(sql)
      .bind(...binds)
      .all()) as { results?: BookNoteRow[] }

    const notes = (result.results ?? []).map(mapBookNoteRow)

    return NextResponse.json({
      success: true,
      notes,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch book notes",
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
          content?: unknown
          position?: unknown
        }
      | null

    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request, body.user_id)
    const id = asNullableString(body.id) ?? newId("note")
    const bookId = parsePositiveIntFromUnknown(body.book_id ?? body.bookId)
    const pageNumber = parsePositiveIntFromUnknown(body.page_number ?? body.pageNumber)
    const content = asNullableString(body.content)
    const position = serializePosition(body.position)

    if (!bookId || !pageNumber || !content) {
      return NextResponse.json({ success: false, error: "book_id, page_number, and content are required" }, { status: 400 })
    }

    await db
      .prepare(
        `INSERT INTO book_notes
          (id, book_id, page_number, content, position, user_id)
        VALUES
          (?, ?, ?, ?, ?, ?)`
      )
      .bind(id, bookId, pageNumber, content, position, userId)
      .run()

    const note = await fetchBookNoteById(db, id, userId)
    if (!note) {
      return NextResponse.json({ success: false, error: "Created note but failed to load it" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      note,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create book note",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

