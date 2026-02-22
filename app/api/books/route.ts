import { NextRequest, NextResponse } from "next/server"

import { BOOK_SELECT_SQL, BookRow, normalizeBookForResponse, parsePositiveInt } from "@/lib/server/books-db"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { extractAssetKey } from "@/lib/server/storage"

const DEFAULT_PAGE_SIZE = 12
const MAX_PAGE_SIZE = 50

type InsertBookPayload = {
  title?: string
  description?: string
  author?: string
  publisher?: string
  isbn?: string
  tags?: string
  year?: number | string | null
  cover_url?: string | null
  file_url?: string | null
  user_id?: string | null
  video_url?: string | null
  video_file_url?: string | null
  video_title?: string | null
  video_description?: string | null
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function asNullableYear(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  const parsed = Number.parseInt(String(value), 10)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function normalizeStoredAssetValue(
  value: string | null,
  kind: "book-cover" | "book-file" | "video-file"
) {
  if (!value) return null

  const key = extractAssetKey(value) ?? value
  if (key.includes("/")) return key

  return `${kind}/${key}`
}

function clampPageSize(value: number) {
  if (value < 1) return DEFAULT_PAGE_SIZE
  return Math.min(value, MAX_PAGE_SIZE)
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const url = new URL(request.url)

    const page = parsePositiveInt(url.searchParams.get("page"), 1)
    const pageSize = clampPageSize(parsePositiveInt(url.searchParams.get("pageSize"), DEFAULT_PAGE_SIZE))
    const offset = (page - 1) * pageSize

    const totalRow = (await db.prepare('SELECT COUNT(*) AS count FROM "Booklist"').first()) as
      | { count: number }
      | null
    const total = Number(totalRow?.count ?? 0)

    const rowsResult = (await db
      .prepare(`${BOOK_SELECT_SQL} ORDER BY datetime(created_at) DESC LIMIT ? OFFSET ?`)
      .bind(pageSize, offset)
      .all()) as { results?: BookRow[] }

    const books = (rowsResult?.results ?? []).map(normalizeBookForResponse)

    return NextResponse.json({
      success: true,
      page,
      pageSize,
      total,
      books,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch books",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    const body = (await request.json().catch(() => null)) as InsertBookPayload | null
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const title = asNullableString(body.title)
    if (!title) {
      return NextResponse.json({ success: false, error: "title is required" }, { status: 400 })
    }

    const description = asNullableString(body.description)
    const author = asNullableString(body.author)
    const publisher = asNullableString(body.publisher)
    const isbn = asNullableString(body.isbn)
    const tags = asNullableString(body.tags)
    const year = asNullableYear(body.year)
    const coverUrl = normalizeStoredAssetValue(asNullableString(body.cover_url), "book-cover")
    const fileUrl = normalizeStoredAssetValue(asNullableString(body.file_url), "book-file")
    const userId = asNullableString(body.user_id)
    const videoUrl = asNullableString(body.video_url)
    const videoFileUrl = normalizeStoredAssetValue(asNullableString(body.video_file_url), "video-file")
    const videoTitle = asNullableString(body.video_title)
    const videoDescription = asNullableString(body.video_description)

    const insertResult = await db
      .prepare(
        `INSERT INTO "Booklist"
          (title, description, author, publisher, isbn, tags, year, cover_url, file_url, user_id, video_url, video_file_url, video_title, video_description)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        title,
        description,
        author,
        publisher,
        isbn,
        tags,
        year,
        coverUrl,
        fileUrl,
        userId,
        videoUrl,
        videoFileUrl,
        videoTitle,
        videoDescription
      )
      .run()

    const newId = Number(insertResult?.meta?.last_row_id)
    if (!Number.isFinite(newId) || newId <= 0) {
      return NextResponse.json({ success: false, error: "Book created but id was not returned" }, { status: 500 })
    }

    const row = (await db
      .prepare(`${BOOK_SELECT_SQL} WHERE id = ? LIMIT 1`)
      .bind(newId)
      .first()) as BookRow | null

    if (!row) {
      return NextResponse.json({ success: false, error: "Book created but cannot be fetched" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      book: normalizeBookForResponse(row),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create book",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
