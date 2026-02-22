import { NextRequest, NextResponse } from "next/server"

import { BOOK_SELECT_SQL, BookRow, normalizeBookForResponse } from "@/lib/server/books-db"
import { getR2Bucket, requireD1Database } from "@/lib/server/cloudflare-bindings"
import { extractAssetKey } from "@/lib/server/storage"

function parseId(raw: string) {
  const id = Number.parseInt(raw, 10)
  if (!Number.isFinite(id) || id <= 0) return null
  return id
}

async function deleteR2ObjectIfPresent(bucket: any, storedValue: string | null) {
  if (!bucket || !storedValue) return
  const key = extractAssetKey(storedValue)
  if (!key) return
  await bucket.delete(key)
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const bucket = getR2Bucket()

    const { id: rawId } = await params
    const id = parseId(rawId)
    if (!id) {
      return NextResponse.json({ success: false, error: "Invalid book id" }, { status: 400 })
    }

    const existing = (await db
      .prepare('SELECT id, cover_url, file_url, video_file_url FROM "Booklist" WHERE id = ? LIMIT 1')
      .bind(id)
      .first()) as { id: number; cover_url: string | null; file_url: string | null; video_file_url: string | null } | null

    if (!existing) {
      return NextResponse.json({ success: false, error: "Book not found" }, { status: 404 })
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
