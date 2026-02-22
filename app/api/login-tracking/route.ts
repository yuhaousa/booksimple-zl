import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveUserIdFromRequest, resolveUserIdValue } from "@/lib/server/request-user"

function asNullableString(value: unknown) {
  if (value === null || value === undefined) return null
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function newSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const url = new URL(request.url)
    const userId = asNullableString(url.searchParams.get("userId"))

    if (userId) {
      const row = await db
        .prepare("SELECT * FROM user_login_stats WHERE user_id = ? LIMIT 1")
        .bind(userId)
        .first()

      return NextResponse.json({
        success: true,
        stats: row ?? null,
      })
    }

    const result = (await db
      .prepare("SELECT * FROM user_login_stats ORDER BY datetime(last_login_at) DESC")
      .all()) as { results?: unknown[] }

    return NextResponse.json({
      success: true,
      stats: result.results ?? [],
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch login stats",
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
          userAgent?: unknown
          user_agent?: unknown
          session_id?: unknown
          sessionId?: unknown
        }
      | null

    const userId = resolveUserIdFromRequest(request, body?.user_id)
    const userAgent =
      asNullableString(body?.user_agent) ??
      asNullableString(body?.userAgent) ??
      request.headers.get("user-agent") ??
      null
    const sessionId = asNullableString(body?.session_id) ?? asNullableString(body?.sessionId) ?? newSessionId()

    await db
      .prepare(
        `INSERT INTO login_tracking
          (user_id, login_timestamp, user_agent, session_id)
        VALUES
          (?, CURRENT_TIMESTAMP, ?, ?)`
      )
      .bind(resolveUserIdValue(userId), userAgent, sessionId)
      .run()

    return NextResponse.json({
      success: true,
      login: {
        user_id: resolveUserIdValue(userId),
        session_id: sessionId,
      },
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to record login",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

