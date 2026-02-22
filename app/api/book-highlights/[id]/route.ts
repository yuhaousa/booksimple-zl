import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveUserIdFromRequest } from "@/lib/server/request-user"

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

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function parsePositiveIntFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value !== "string") return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
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
    .first()) as
    | {
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
    | null

  if (!row) return null
  return {
    ...row,
    position: parsePosition(row.position),
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const { id } = await params
    const highlightId = id?.trim()
    if (!highlightId) {
      return NextResponse.json({ success: false, error: "Invalid highlight id" }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as
      | {
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

    const updates: Record<string, unknown> = {}
    if (Object.prototype.hasOwnProperty.call(body, "page_number") || Object.prototype.hasOwnProperty.call(body, "pageNumber")) {
      const pageNumber = parsePositiveIntFromUnknown(body.page_number ?? body.pageNumber)
      if (!pageNumber) {
        return NextResponse.json({ success: false, error: "page_number must be a positive integer" }, { status: 400 })
      }
      updates.page_number = pageNumber
    }
    if (Object.prototype.hasOwnProperty.call(body, "text")) {
      const text = asNullableString(body.text)
      if (!text) {
        return NextResponse.json({ success: false, error: "text cannot be empty" }, { status: 400 })
      }
      updates.text = text
    }
    if (Object.prototype.hasOwnProperty.call(body, "color")) {
      const color = asNullableString(body.color)
      if (!color) {
        return NextResponse.json({ success: false, error: "color cannot be empty" }, { status: 400 })
      }
      updates.color = color
    }
    if (Object.prototype.hasOwnProperty.call(body, "position")) {
      updates.position = serializePosition(body.position)
    }

    const columns = Object.keys(updates)
    if (columns.length === 0) {
      return NextResponse.json({ success: false, error: "No fields provided for update" }, { status: 400 })
    }

    const setClause = [...columns.map((column) => `${column} = ?`), "updated_at = CURRENT_TIMESTAMP"].join(", ")
    const values = columns.map((column) => updates[column])

    const result = await db
      .prepare(`UPDATE book_highlights SET ${setClause} WHERE id = ? AND user_id = ?`)
      .bind(...values, highlightId, userId)
      .run()

    if (!result?.meta?.changes) {
      return NextResponse.json({ success: false, error: "Highlight not found" }, { status: 404 })
    }

    const highlight = await fetchHighlightById(db, highlightId, userId)
    if (!highlight) {
      return NextResponse.json({ success: false, error: "Updated highlight but failed to load it" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      highlight,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update highlight",
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
    const { id } = await params
    const highlightId = id?.trim()
    if (!highlightId) {
      return NextResponse.json({ success: false, error: "Invalid highlight id" }, { status: 400 })
    }

    const result = await db
      .prepare("DELETE FROM book_highlights WHERE id = ? AND user_id = ?")
      .bind(highlightId, userId)
      .run()

    if (!result?.meta?.changes) {
      return NextResponse.json({ success: false, error: "Highlight not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      deleted: Number(result.meta.changes),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete highlight",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

