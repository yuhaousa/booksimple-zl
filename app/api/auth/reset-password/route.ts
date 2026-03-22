import { NextRequest, NextResponse } from "next/server"

import { ensureAuthTables, normalizeValue } from "@/lib/server/auth-db"
import { consumeAuthToken } from "@/lib/server/auth-tokens"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { hashPassword } from "@/lib/server/password"

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    await ensureAuthTables(db)

    const body = (await request.json().catch(() => null)) as
      | {
          token?: unknown
          password?: unknown
        }
      | null

    const token = normalizeValue(body?.token)
    const password = normalizeValue(body?.password)

    if (!token || !password) {
      return NextResponse.json({ success: false, error: "Token and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const payload = await consumeAuthToken(db, token, "reset_password")
    if (!payload) {
      return NextResponse.json({ success: false, error: "This reset link is invalid or has expired" }, { status: 400 })
    }

    const passwordHash = await hashPassword(password)
    await db
      .prepare("UPDATE auth_credentials SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
      .bind(passwordHash, payload.user_id)
      .run()

    return NextResponse.json({
      success: true,
      message: "Password reset successful. You can now sign in.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset password",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
