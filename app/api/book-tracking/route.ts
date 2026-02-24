import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { parsePositiveInt, resolveUserIdFromRequest } from "@/lib/server/request-user"

function parsePositiveIntFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value !== "string") return null
  return parsePositiveInt(value)
}

function calculateProgress(currentPage: number, totalPages: number) {
  if (totalPages <= 0) return 0
  const clampedCurrent = Math.max(0, Math.min(currentPage, totalPages))
  return Number(((clampedCurrent / totalPages) * 100).toFixed(2))
}

async function syncReadingListFromProgress(db: any, userId: string, bookId: number, progress: number) {
  try {
    const derivedStatus = progress >= 100 ? "completed" : "reading"

    await db
      .prepare(
        `INSERT INTO reading_list_full (user_id, book_id, status)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, book_id) DO NOTHING`
      )
      .bind(userId, bookId, derivedStatus)
      .run()

    if (derivedStatus === "completed") {
      await db
        .prepare(
          `UPDATE reading_list_full
           SET status = 'completed', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND book_id = ? AND status != 'completed'`
        )
        .bind(userId, bookId)
        .run()
    } else {
      await db
        .prepare(
          `UPDATE reading_list_full
           SET status = 'reading', updated_at = CURRENT_TIMESTAMP
           WHERE user_id = ? AND book_id = ? AND status = 'to_read'`
        )
        .bind(userId, bookId)
        .run()
    }
  } catch {
    // Ignore sync errors so reading progress updates still succeed.
  }
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const url = new URL(request.url)
    const bookId = parsePositiveInt(url.searchParams.get("bookId"))

    let sql = `SELECT
      id,
      user_id,
      book_id,
      current_page,
      total_pages,
      progress_percentage,
      last_read_at,
      created_at,
      updated_at
    FROM book_tracking
    WHERE user_id = ?`
    const binds: unknown[] = [userId]

    if (bookId) {
      sql += " AND book_id = ?"
      binds.push(bookId)
    }

    sql += " ORDER BY datetime(last_read_at) DESC"

    const result = (await db
      .prepare(sql)
      .bind(...binds)
      .all()) as { results?: unknown[] }

    return NextResponse.json({
      success: true,
      records: result.results ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch reading progress",
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
          current_page?: unknown
          currentPage?: unknown
          total_pages?: unknown
          totalPages?: unknown
        }
      | null

    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request, body.user_id)
    const bookId = parsePositiveIntFromUnknown(body.book_id ?? body.bookId)
    const currentPage = parsePositiveIntFromUnknown(body.current_page ?? body.currentPage)
    const totalPages = parsePositiveIntFromUnknown(body.total_pages ?? body.totalPages)

    if (!bookId || !currentPage || !totalPages) {
      return NextResponse.json(
        { success: false, error: "book_id, current_page, and total_pages are required positive integers" },
        { status: 400 }
      )
    }

    const progress = calculateProgress(currentPage, totalPages)

    await db
      .prepare(
        `INSERT INTO book_tracking
          (user_id, book_id, current_page, total_pages, progress_percentage, last_read_at)
        VALUES
          (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, book_id)
        DO UPDATE SET
          current_page = excluded.current_page,
          total_pages = excluded.total_pages,
          progress_percentage = excluded.progress_percentage,
          last_read_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP`
      )
      .bind(userId, bookId, currentPage, totalPages, progress)
      .run()

    await syncReadingListFromProgress(db, userId, bookId, progress)

    const row = (await db
      .prepare(
        `SELECT
          id,
          user_id,
          book_id,
          current_page,
          total_pages,
          progress_percentage,
          last_read_at,
          created_at,
          updated_at
        FROM book_tracking
        WHERE user_id = ? AND book_id = ?
        LIMIT 1`
      )
      .bind(userId, bookId)
      .first()) as unknown

    return NextResponse.json({
      success: true,
      record: row,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update reading progress",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
