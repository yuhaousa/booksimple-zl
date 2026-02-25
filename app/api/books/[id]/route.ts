import { NextRequest, NextResponse } from "next/server"

import { BOOK_SELECT_SQL, BookRow, normalizeBookForResponse } from "@/lib/server/books-db"
import { getR2Bucket, requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"
import { extractAssetKey } from "@/lib/server/storage"

type UpdateBookPayload = {
  title?: string
  description?: string | null
  author?: string | null
  publisher?: string | null
  isbn?: string | null
  tags?: string | null
  year?: number | string | null
  cover_url?: string | null
  file_url?: string | null
  user_id?: string | null
  video_url?: string | null
  video_file_url?: string | null
  video_title?: string | null
  video_description?: string | null
}

function parseId(raw: string) {
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
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

async function deleteR2ObjectIfPresent(bucket: any, storedValue: string | null) {
  if (!bucket || !storedValue) return
  const key = extractAssetKey(storedValue)
  if (!key) return
  await bucket.delete(key)
}

async function isAdminUser(db: any, userId: string | null) {
  if (!userId) return false
  const row = (await db
    .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
    .bind(userId)
    .first()) as { user_id: string } | null
  return !!row
}

function canAccessBook(requesterUserId: string | null, ownerUserId: string | null, admin: boolean) {
  if (admin) return true
  if (!requesterUserId) return false
  if (!ownerUserId) return false
  return requesterUserId === ownerUserId
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const requesterUserId = resolveSessionUserIdFromRequest(request)
    const admin = await isAdminUser(db, requesterUserId)
    const { id: rawId } = await params
    const id = parseId(rawId)
    if (!id) {
      return NextResponse.json({ success: false, error: "Invalid book id" }, { status: 400 })
    }

    const row = (await db
      .prepare(`${BOOK_SELECT_SQL} WHERE id = ? LIMIT 1`)
      .bind(id)
      .first()) as BookRow | null

    if (!row) {
      return NextResponse.json({ success: false, error: "Book not found" }, { status: 404 })
    }

    if (!canAccessBook(requesterUserId, row.user_id, admin)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    return NextResponse.json({
      success: true,
      book: normalizeBookForResponse(row),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch book",
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
    const bucket = getR2Bucket()
    const requesterUserId = resolveSessionUserIdFromRequest(request)
    const admin = await isAdminUser(db, requesterUserId)

    const { id: rawId } = await params
    const id = parseId(rawId)
    if (!id) {
      return NextResponse.json({ success: false, error: "Invalid book id" }, { status: 400 })
    }

    const existing = (await db
      .prepare('SELECT id, user_id, cover_url, file_url, video_file_url FROM "Booklist" WHERE id = ? LIMIT 1')
      .bind(id)
      .first()) as {
      id: number
      user_id: string | null
      cover_url: string | null
      file_url: string | null
      video_file_url: string | null
    } | null

    if (!existing) {
      return NextResponse.json({ success: false, error: "Book not found" }, { status: 404 })
    }

    if (!canAccessBook(requesterUserId, existing.user_id, admin)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    await db.prepare('DELETE FROM "Booklist" WHERE id = ?').bind(id).run()

    try {
      await Promise.all([
        deleteR2ObjectIfPresent(bucket, existing.cover_url),
        deleteR2ObjectIfPresent(bucket, existing.file_url),
        deleteR2ObjectIfPresent(bucket, existing.video_file_url),
      ])
    } catch {
      // Keep delete successful even when storage cleanup fails.
    }

    return NextResponse.json({
      success: true,
      message: "Book deleted",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete book",
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
    const requesterUserId = resolveSessionUserIdFromRequest(request)
    const admin = await isAdminUser(db, requesterUserId)
    const { id: rawId } = await params
    const id = parseId(rawId)
    if (!id) {
      return NextResponse.json({ success: false, error: "Invalid book id" }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as UpdateBookPayload | null
    if (!body || typeof body !== "object") {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const existing = (await db
      .prepare('SELECT id, user_id FROM "Booklist" WHERE id = ? LIMIT 1')
      .bind(id)
      .first()) as { id: number; user_id: string | null } | null

    if (!existing) {
      return NextResponse.json({ success: false, error: "Book not found" }, { status: 404 })
    }

    if (!canAccessBook(requesterUserId, existing.user_id, admin)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const updates: Record<string, unknown> = {}
    const has = (key: keyof UpdateBookPayload) => Object.prototype.hasOwnProperty.call(body, key)

    if (has("title")) {
      const title = asNullableString(body.title)
      if (!title) {
        return NextResponse.json({ success: false, error: "title is required" }, { status: 400 })
      }
      updates.title = title
    }
    if (has("description")) updates.description = asNullableString(body.description)
    if (has("author")) updates.author = asNullableString(body.author)
    if (has("publisher")) updates.publisher = asNullableString(body.publisher)
    if (has("isbn")) updates.isbn = asNullableString(body.isbn)
    if (has("tags")) updates.tags = asNullableString(body.tags)
    if (has("year")) updates.year = asNullableYear(body.year)
    if (has("cover_url")) updates.cover_url = normalizeStoredAssetValue(asNullableString(body.cover_url), "book-cover")
    if (has("file_url")) updates.file_url = normalizeStoredAssetValue(asNullableString(body.file_url), "book-file")
    if (has("user_id")) updates.user_id = asNullableString(body.user_id)
    if (has("video_url")) updates.video_url = asNullableString(body.video_url)
    if (has("video_file_url"))
      updates.video_file_url = normalizeStoredAssetValue(asNullableString(body.video_file_url), "video-file")
    if (has("video_title")) updates.video_title = asNullableString(body.video_title)
    if (has("video_description")) updates.video_description = asNullableString(body.video_description)

    const columns = Object.keys(updates)
    if (columns.length === 0) {
      return NextResponse.json({ success: false, error: "No fields provided for update" }, { status: 400 })
    }

    const setClause = columns.map((column) => `${column} = ?`).join(", ")
    const values = columns.map((column) => updates[column])

    await db
      .prepare(`UPDATE "Booklist" SET ${setClause} WHERE id = ?`)
      .bind(...values, id)
      .run()

    const row = (await db
      .prepare(`${BOOK_SELECT_SQL} WHERE id = ? LIMIT 1`)
      .bind(id)
      .first()) as BookRow | null

    if (!row) {
      return NextResponse.json({ success: false, error: "Book updated but cannot be fetched" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      book: normalizeBookForResponse(row),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update book",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
