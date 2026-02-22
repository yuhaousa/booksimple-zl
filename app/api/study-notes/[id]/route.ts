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

function parseId(raw: string) {
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

function parsePositiveIntFromUnknown(value: unknown) {
  if (value === null || value === undefined || value === "") return null
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const { id: rawId } = await params
    const noteId = parseId(rawId)
    if (!noteId) {
      return NextResponse.json({ success: false, error: "Invalid note id" }, { status: 400 })
    }

    const note = await fetchStudyNoteById(db, noteId, userId)
    if (!note) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      note,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch study note",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    const { id: rawId } = await params
    const noteId = parseId(rawId)
    if (!noteId) {
      return NextResponse.json({ success: false, error: "Invalid note id" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key)

    if (has("title")) updates.title = asNullableString(body.title)
    if (has("content")) {
      const content = asNullableString(body.content)
      if (!content) {
        return NextResponse.json({ success: false, error: "content cannot be empty" }, { status: 400 })
      }
      updates.content = content
    }
    if (has("book_id") || has("bookId")) updates.book_id = parsePositiveIntFromUnknown(body.book_id ?? body.bookId)
    if (has("tags")) updates.tags = asNullableString(body.tags)
    if (has("category")) updates.category = asNullableString(body.category)

    const columns = Object.keys(updates)
    if (columns.length === 0) {
      return NextResponse.json({ success: false, error: "No fields provided for update" }, { status: 400 })
    }

    const setClause = [...columns.map((column) => `${column} = ?`), "updated_at = CURRENT_TIMESTAMP"].join(", ")
    const values = columns.map((column) => updates[column])

    const result = await db
      .prepare(`UPDATE study_notes SET ${setClause} WHERE id = ? AND user_id = ?`)
      .bind(...values, noteId, userId)
      .run()

    if (!result?.meta?.changes) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 })
    }

    const note = await fetchStudyNoteById(db, noteId, userId)
    if (!note) {
      return NextResponse.json({ success: false, error: "Updated note but failed to load it" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      note,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update study note",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const { id: rawId } = await params
    const noteId = parseId(rawId)
    if (!noteId) {
      return NextResponse.json({ success: false, error: "Invalid note id" }, { status: 400 })
    }

    const result = await db
      .prepare("DELETE FROM study_notes WHERE id = ? AND user_id = ?")
      .bind(noteId, userId)
      .run()

    if (!result?.meta?.changes) {
      return NextResponse.json({ success: false, error: "Note not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      deleted: Number(result.meta.changes),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete study note",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

