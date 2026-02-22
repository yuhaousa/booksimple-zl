import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { parsePositiveInt, resolveUserIdFromRequest } from "@/lib/server/request-user"

type CustomOutlineRow = {
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

function newId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

async function fetchCustomOutlineById(db: any, id: string, userId: string) {
  return (await db
    .prepare(
      `SELECT
        id, book_id, title, page_number, parent_id, sort_order, original_pdf_index, user_id, created_at, updated_at
      FROM custom_outline
      WHERE id = ? AND user_id = ?
      LIMIT 1`
    )
    .bind(id, userId)
    .first()) as CustomOutlineRow | null
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const userId = resolveUserIdFromRequest(request)
    const url = new URL(request.url)
    const bookId = parsePositiveInt(url.searchParams.get("bookId"))

    if (!bookId) {
      return NextResponse.json({ success: false, error: "bookId is required" }, { status: 400 })
    }

    const result = (await db
      .prepare(
        `SELECT
          id, book_id, title, page_number, parent_id, sort_order, original_pdf_index, user_id, created_at, updated_at
        FROM custom_outline
        WHERE user_id = ? AND book_id = ?
        ORDER BY sort_order ASC, datetime(created_at) ASC`
      )
      .bind(userId, bookId)
      .all()) as { results?: CustomOutlineRow[] }

    return NextResponse.json({
      success: true,
      outlines: result.results ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch custom outline",
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

    const userId = resolveUserIdFromRequest(request, body.user_id)
    const id = asNullableString(body.id) ?? newId("outline")
    const bookId = parsePositiveIntFromUnknown(body.book_id ?? body.bookId)
    const title = asNullableString(body.title)
    const pageNumber = parsePositiveIntFromUnknown(body.page_number ?? body.pageNumber)
    const parentId = asNullableString(body.parent_id)
    const sortOrder = parseNullableIntFromUnknown(body.sort_order ?? body.sortOrder) ?? 0
    const originalPdfIndex = parseNullableIntFromUnknown(body.original_pdf_index ?? body.originalPdfIndex)

    if (!bookId || !title || !pageNumber) {
      return NextResponse.json({ success: false, error: "book_id, title, and page_number are required" }, { status: 400 })
    }

    await db
      .prepare(
        `INSERT INTO custom_outline
          (id, book_id, title, page_number, parent_id, sort_order, original_pdf_index, user_id)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(id, bookId, title, pageNumber, parentId, sortOrder, originalPdfIndex, userId)
      .run()

    const outline = await fetchCustomOutlineById(db, id, userId)
    if (!outline) {
      return NextResponse.json({ success: false, error: "Created outline but failed to load it" }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      outline,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create custom outline item",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

