import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { parsePositiveInt, resolveUserIdFromRequest } from "@/lib/server/request-user"
import { toAssetUrl } from "@/lib/server/storage"

const ALLOWED_STATUS = new Set(["to_read", "reading", "completed"])

type ReadingListJoinRow = {
  id: number
  book_id: number
  status: "to_read" | "reading" | "completed"
  added_at: string
  user_id: string
  title: string | null
  author: string | null
  publisher: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  description: string | null
  tags: string | null
  book_user_id: string | null
}

function parsePositiveIntFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value !== "string") return null
  return parsePositiveInt(value)
}

function normalizeStatus(value: unknown) {
  if (typeof value !== "string") return null
  const normalized = value.trim().toLowerCase()
  if (!ALLOWED_STATUS.has(normalized)) return null
  return normalized as "to_read" | "reading" | "completed"
}

function mapReadingListRow(row: ReadingListJoinRow) {
  return {
    id: row.id,
    book_id: row.book_id,
    status: row.status,
    added_at: row.added_at,
    user_id: row.user_id,
    book: {
      id: row.book_id,
      title: row.title,
      author: row.author,
      publisher: row.publisher,
      year: row.year,
      cover_url: toAssetUrl(row.cover_url),
      file_url: toAssetUrl(row.file_url),
      description: row.description,
      tags: row.tags,
      user_id: row.book_user_id,
    },
  }
}

async function fetchReadingListItem(db: any, itemId: number, userId: string) {
  const row = (await db
    .prepare(
      `SELECT
        rl.id,
        rl.book_id,
        rl.status,
        rl.added_at,
        rl.user_id,
        b.title,
        b.author,
        b.publisher,
        b.year,
        b.cover_url,
        b.file_url,
        b.description,
        b.tags,
        b.user_id AS book_user_id
      FROM reading_list_full rl
      JOIN "Booklist" b ON b.id = rl.book_id
      WHERE rl.id = ? AND rl.user_id = ?
      LIMIT 1`
    )
    .bind(itemId, userId)
    .first()) as ReadingListJoinRow | null

  return row ? mapReadingListRow(row) : null
}

async function fetchReadingListItemByBookId(db: any, bookId: number, userId: string) {
  const row = (await db
    .prepare(
      `SELECT
        rl.id,
        rl.book_id,
        rl.status,
        rl.added_at,
        rl.user_id,
        b.title,
        b.author,
        b.publisher,
        b.year,
        b.cover_url,
        b.file_url,
        b.description,
        b.tags,
        b.user_id AS book_user_id
      FROM reading_list_full rl
      JOIN "Booklist" b ON b.id = rl.book_id
      WHERE rl.book_id = ? AND rl.user_id = ?
      LIMIT 1`
    )
    .bind(bookId, userId)
    .first()) as ReadingListJoinRow | null

  return row ? mapReadingListRow(row) : null
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const url = new URL(request.url)

    const bookId = parsePositiveInt(url.searchParams.get("bookId"))
    const status = normalizeStatus(url.searchParams.get("status"))

    let sql = `SELECT
      rl.id,
      rl.book_id,
      rl.status,
      rl.added_at,
      rl.user_id,
      b.title,
      b.author,
      b.publisher,
      b.year,
      b.cover_url,
      b.file_url,
      b.description,
      b.tags,
      b.user_id AS book_user_id
    FROM reading_list_full rl
    JOIN "Booklist" b ON b.id = rl.book_id
    WHERE rl.user_id = ?`

    const binds: unknown[] = [userId]

    if (bookId) {
      sql += " AND rl.book_id = ?"
      binds.push(bookId)
    }

    if (status) {
      sql += " AND rl.status = ?"
      binds.push(status)
    }

    sql += " ORDER BY datetime(rl.added_at) DESC"

    const result = (await db
      .prepare(sql)
      .bind(...binds)
      .all()) as { results?: ReadingListJoinRow[] }

    const items = (result.results ?? []).map(mapReadingListRow)

    return NextResponse.json({
      success: true,
      items,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch reading list",
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
          book_id?: unknown
          bookId?: unknown
          status?: unknown
        }
      | null

    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request, body.user_id)
    const bookId = parsePositiveIntFromUnknown(body.book_id ?? body.bookId)
    if (!bookId) {
      return NextResponse.json({ success: false, error: "book_id is required" }, { status: 400 })
    }

    const status = normalizeStatus(body.status) ?? "to_read"

    await db
      .prepare(
        `INSERT INTO reading_list_full (user_id, book_id, status)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, book_id)
         DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP`
      )
      .bind(userId, bookId, status)
      .run()

    const item = await fetchReadingListItemByBookId(db, bookId, userId)
    if (!item) {
      return NextResponse.json({ success: false, error: "Failed to load saved reading-list item" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to save reading list item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const db = requireD1Database()
    const body = (await request.json().catch(() => null)) as
      | {
          user_id?: unknown
          id?: unknown
          status?: unknown
        }
      | null

    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request, body.user_id)
    const itemId = parsePositiveIntFromUnknown(body.id)
    if (!itemId) {
      return NextResponse.json({ success: false, error: "id is required" }, { status: 400 })
    }

    const status = normalizeStatus(body.status)
    if (!status) {
      return NextResponse.json({ success: false, error: "status must be to_read, reading, or completed" }, { status: 400 })
    }

    const result = await db
      .prepare("UPDATE reading_list_full SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?")
      .bind(status, itemId, userId)
      .run()

    if (!result?.meta?.changes) {
      return NextResponse.json({ success: false, error: "Reading-list item not found" }, { status: 404 })
    }

    const item = await fetchReadingListItem(db, itemId, userId)
    if (!item) {
      return NextResponse.json({ success: false, error: "Updated but failed to load item" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      item,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update reading-list item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = requireD1Database()
    const url = new URL(request.url)

    const body = (await request.json().catch(() => null)) as
      | {
          user_id?: unknown
          id?: unknown
          book_id?: unknown
          bookId?: unknown
        }
      | null

    const userId = resolveUserIdFromRequest(request, body?.user_id)
    const itemId = parsePositiveInt(url.searchParams.get("id")) ?? parsePositiveIntFromUnknown(body?.id)
    const bookId =
      parsePositiveInt(url.searchParams.get("bookId")) ??
      parsePositiveIntFromUnknown(body?.book_id ?? body?.bookId)

    if (!itemId && !bookId) {
      return NextResponse.json({ success: false, error: "Provide id or bookId to delete" }, { status: 400 })
    }

    const result = itemId
      ? await db.prepare("DELETE FROM reading_list_full WHERE id = ? AND user_id = ?").bind(itemId, userId).run()
      : await db.prepare("DELETE FROM reading_list_full WHERE book_id = ? AND user_id = ?").bind(bookId, userId).run()

    if (!result?.meta?.changes) {
      return NextResponse.json({ success: false, error: "Reading-list item not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      deleted: Number(result.meta.changes),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete reading-list item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

