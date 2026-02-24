import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

export async function GET(request: NextRequest) {
  try {
    const userId = resolveSessionUserIdFromRequest(request)
    if (!userId) {
      return NextResponse.json({ success: true, isAdmin: false })
    }

    const db = requireD1Database()
    const row = (await db
      .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first()) as { user_id: string } | null

    return NextResponse.json({ success: true, isAdmin: !!row })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to check admin access",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
