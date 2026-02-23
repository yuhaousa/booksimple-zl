import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

export async function GET(request: NextRequest) {
  try {
    const userId = resolveSessionUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ success: true, user: null })
    }

    const db = requireD1Database()
    const row = (await db
      .prepare(
        `SELECT
          auth_user_id AS id,
          email,
          display_name
        FROM user_list
        WHERE auth_user_id = ?
        LIMIT 1`
      )
      .bind(userId)
      .first()) as
      | {
          id: string
          email: string | null
          display_name: string | null
        }
      | null

    if (!row) {
      return NextResponse.json({ success: true, user: null })
    }

    return NextResponse.json({ success: true, user: row })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch session user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

