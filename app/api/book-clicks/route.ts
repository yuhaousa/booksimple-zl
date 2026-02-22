import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { parsePositiveInt, resolveUserIdFromRequest } from "@/lib/server/request-user"

const ALLOWED_CLICK_TYPES = new Set(["read", "download"])

function parsePositiveIntFromUnknown(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value)
  }
  if (typeof value !== "string") return null
  return parsePositiveInt(value)
}

function normalizeClickType(value: unknown) {
  if (typeof value !== "string") return "read" as const
  const normalized = value.trim().toLowerCase()
  if (!ALLOWED_CLICK_TYPES.has(normalized)) return "read" as const
  return normalized as "read" | "download"
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const url = new URL(request.url)
    const mode = url.searchParams.get("mode")

    if (mode === "stats") {
      const result = (await db
        .prepare("SELECT * FROM book_click_stats ORDER BY total_clicks DESC")
        .all()) as { results?: unknown[] }

      return NextResponse.json({
        success: true,
        stats: result.results ?? [],
      })
    }

    const limit = Math.min(parsePositiveInt(url.searchParams.get("limit")) ?? 50, 200)
    const result = (await db
      .prepare(
        `SELECT id, book_id, user_id, click_type, clicked_at, ip_address, user_agent, created_at
         FROM book_clicks
         ORDER BY datetime(clicked_at) DESC
         LIMIT ?`
      )
      .bind(limit)
      .all()) as { results?: unknown[] }

    return NextResponse.json({
      success: true,
      clicks: result.results ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch book clicks",
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
          click_type?: unknown
          clickType?: unknown
          user_agent?: unknown
          userAgent?: unknown
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

    const clickType = normalizeClickType(body.click_type ?? body.clickType)
    const userAgent =
      (typeof body.user_agent === "string" && body.user_agent.trim()) ||
      (typeof body.userAgent === "string" && body.userAgent.trim()) ||
      request.headers.get("user-agent") ||
      null

    await db
      .prepare(
        `INSERT INTO book_clicks
          (book_id, user_id, click_type, clicked_at, user_agent)
        VALUES
          (?, ?, ?, CURRENT_TIMESTAMP, ?)`
      )
      .bind(bookId, userId, clickType, userAgent)
      .run()

    return NextResponse.json({
      success: true,
      click: {
        book_id: bookId,
        user_id: userId,
        click_type: clickType,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to record book click",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

