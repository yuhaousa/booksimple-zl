import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { parsePositiveInt, resolveUserIdFromRequest } from "@/lib/server/request-user"

type StudyNoteRow = {
  id: number
  title: string
  content: string
  book_id: number | null
  user_id: string | null
  tags: string | null
  category: string | null
  created_at: string
  updated_at: string
  book_title: string | null
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function parsePositiveIntFromUnknown(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value !== "string") return null
  return parsePositiveInt(value)
}

function mapStudyNoteRow(row: StudyNoteRow) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    book_id: row.book_id,
    user_id: row.user_id,
    tags: row.tags,
    category: row.category,
    created_at: row.created_at,
    updated_at: row.updated_at,
    book: row.book_id
      ? {
          id: row.book_id,
          title: row.book_title,
        }
      : null,
  }
}

async function fetchStudyNoteById(db: any, noteId: number, userId: string) {
  const row = (await db
    .prepare(
      `SELECT
        n.id,
        n.title,
        n.content,
        n.book_id,
        n.user_id,
        n.tags,
        n.category,
        n.created_at,
        n.updated_at,
        b.title AS book_title
      FROM study_notes n
      LEFT JOIN "Booklist" b ON b.id = n.book_id
      WHERE n.id = ? AND n.user_id = ?
      LIMIT 1`
    )
    .bind(noteId, userId)
    .first()) as StudyNoteRow | null

  return row ? mapStudyNoteRow(row) : null
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const url = new URL(request.url)
    const bookId = parsePositiveInt(url.searchParams.get("bookId"))

    let sql = `SELECT
      n.id,
      n.title,
      n.content,
      n.book_id,
      n.user_id,
      n.tags,
      n.category,
      n.created_at,
      n.updated_at,
      b.title AS book_title
    FROM study_notes n
    LEFT JOIN "Booklist" b ON b.id = n.book_id
    WHERE n.user_id = ?`

    const binds: unknown[] = [userId]
    if (bookId) {
      sql += " AND n.book_id = ?"
      binds.push(bookId)
    }

    sql += " ORDER BY datetime(n.created_at) DESC"

    const result = (await db
      .prepare(sql)
      .bind(...binds)
      .all()) as { results?: StudyNoteRow[] }

    const notes = (result.results ?? []).map(mapStudyNoteRow)

    return NextResponse.json({
      success: true,
      notes,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch study notes",
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
          title?: unknown
          content?: unknown
          book_id?: unknown
          bookId?: unknown
          tags?: unknown
          category?: unknown
        }
      | null

    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request, body.user_id)
    const content = asNullableString(body.content)
    if (!content) {
      return NextResponse.json({ success: false, error: "content is required" }, { status: 400 })
    }

    const title = asNullableString(body.title) ?? content.slice(0, 50)
    const bookId = parsePositiveIntFromUnknown(body.book_id ?? body.bookId)
    const tags = asNullableString(body.tags)
    const category = asNullableString(body.category)

    const result = await db
      .prepare(
        `INSERT INTO study_notes
          (title, content, book_id, user_id, tags, category)
        VALUES
          (?, ?, ?, ?, ?, ?)`
      )
      .bind(title, content, bookId, userId, tags, category)
      .run()

    const noteId = Number(result?.meta?.last_row_id)
    if (!Number.isFinite(noteId) || noteId <= 0) {
      return NextResponse.json({ success: false, error: "Created note id was not returned" }, { status: 500 })
    }

    const note = await fetchStudyNoteById(db, noteId, userId)
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
        error: "Failed to create study note",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

