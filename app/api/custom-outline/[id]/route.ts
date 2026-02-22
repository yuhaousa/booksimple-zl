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

function parseNullableIntFromUnknown(value: unknown) {
  if (value === null || value === undefined || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return Math.floor(value)
  if (typeof value !== "string") return null
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function fetchOutlineById(db: any, id: string, userId: string) {
  return (await db
    .prepare(
      `SELECT
        id, book_id, title, page_number, parent_id, sort_order, original_pdf_index, user_id, created_at, updated_at
      FROM custom_outline
      WHERE id = ? AND user_id = ?
      LIMIT 1`
    )
    .bind(id, userId)
    .first()) as
    | {
        id: string
        book_id: number
        title: string
        page_number: number
        parent_id: string | null
        sort_order: number
        original_pdf_index: number | null
        user_id: string | null
        created_at: string
        updated_at: string
      }
    | null
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const { id } = await params
    const outlineId = id?.trim()
    if (!outlineId) {
      return NextResponse.json({ success: false, error: "Invalid outline id" }, { status: 400 })
    }

    const body = (await request.json().catch(() => null)) as
      | {
          title?: unknown
          page_number?: unknown
          pageNumber?: unknown
          parent_id?: unknown
          sort_order?: unknown
          sortOrder?: unknown
          original_pdf_index?: unknown
          originalPdfIndex?: unknown
        }
      | null
    if (!body) {
      return NextResponse.json({ success: false, error: "Invalid request body" }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (Object.prototype.hasOwnProperty.call(body, "title")) {
      const title = asNullableString(body.title)
      if (!title) {
        return NextResponse.json({ success: false, error: "title cannot be empty" }, { status: 400 })
      }
      updates.title = title
    }
    if (Object.prototype.hasOwnProperty.call(body, "page_number") || Object.prototype.hasOwnProperty.call(body, "pageNumber")) {
      const pageNumber = parsePositiveIntFromUnknown(body.page_number ?? body.pageNumber)
      if (!pageNumber) {
        return NextResponse.json({ success: false, error: "page_number must be a positive integer" }, { status: 400 })
      }
      updates.page_number = pageNumber
    }
    if (Object.prototype.hasOwnProperty.call(body, "parent_id")) {
      updates.parent_id = asNullableString(body.parent_id)
    }
    if (Object.prototype.hasOwnProperty.call(body, "sort_order") || Object.prototype.hasOwnProperty.call(body, "sortOrder")) {
      updates.sort_order = parseNullableIntFromUnknown(body.sort_order ?? body.sortOrder) ?? 0
    }
    if (Object.prototype.hasOwnProperty.call(body, "original_pdf_index") || Object.prototype.hasOwnProperty.call(body, "originalPdfIndex")) {
      updates.original_pdf_index = parseNullableIntFromUnknown(body.original_pdf_index ?? body.originalPdfIndex)
    }

    const columns = Object.keys(updates)
    if (columns.length === 0) {
      return NextResponse.json({ success: false, error: "No fields provided for update" }, { status: 400 })
    }

    const setClause = [...columns.map((column) => `${column} = ?`), "updated_at = CURRENT_TIMESTAMP"].join(", ")
    const values = columns.map((column) => updates[column])

    const result = await db
      .prepare(`UPDATE custom_outline SET ${setClause} WHERE id = ? AND user_id = ?`)
      .bind(...values, outlineId, userId)
      .run()

    if (!result?.meta?.changes) {
      return NextResponse.json({ success: false, error: "Outline item not found" }, { status: 404 })
    }

    const outline = await fetchOutlineById(db, outlineId, userId)
    if (!outline) {
      return NextResponse.json({ success: false, error: "Updated outline item but failed to load it" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      outline,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update custom outline item",
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
    const outlineId = id?.trim()
    if (!outlineId) {
      return NextResponse.json({ success: false, error: "Invalid outline id" }, { status: 400 })
    }

    const result = await db
      .prepare("DELETE FROM custom_outline WHERE id = ? AND user_id = ?")
      .bind(outlineId, userId)
      .run()

    if (!result?.meta?.changes) {
      return NextResponse.json({ success: false, error: "Outline item not found" }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      deleted: Number(result.meta.changes),
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete custom outline item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

