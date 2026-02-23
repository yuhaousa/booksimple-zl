import { NextRequest, NextResponse } from "next/server"

import { ensureAuthTables, normalizeEmail, normalizeValue } from "@/lib/server/auth-db"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { hashPassword } from "@/lib/server/password"
import { createSessionToken, setSessionCookie } from "@/lib/server/session"

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    await ensureAuthTables(db)

    const body = (await request.json().catch(() => null)) as
      | {
          email?: unknown
          password?: unknown
          name?: unknown
          displayName?: unknown
        }
      | null

    const email = normalizeEmail(body?.email)
    const password = normalizeValue(body?.password)
    const displayName = normalizeValue(body?.name ?? body?.displayName) ?? null

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "email and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const existing = (await db
      .prepare(`SELECT auth_user_id, display_name FROM user_list WHERE lower(email) = ? LIMIT 1`)
      .bind(email)
      .first()) as { auth_user_id: string | null; display_name: string | null } | null

    const passwordHash = await hashPassword(password)
    let userId = crypto.randomUUID()
    let finalDisplayName = displayName

    if (existing) {
      userId = existing.auth_user_id || crypto.randomUUID()
      finalDisplayName = displayName ?? existing.display_name ?? null

      const existingCredential = (await db
        .prepare("SELECT user_id FROM auth_credentials WHERE user_id = ? LIMIT 1")
        .bind(userId)
        .first()) as { user_id: string } | null

      if (existingCredential) {
        return NextResponse.json({ success: false, error: "Email is already registered" }, { status: 409 })
      }

      if (existing.auth_user_id) {
        await db
          .prepare("UPDATE user_list SET display_name = COALESCE(?, display_name) WHERE auth_user_id = ?")
          .bind(finalDisplayName, userId)
          .run()
      } else {
        await db
          .prepare("UPDATE user_list SET auth_user_id = ?, display_name = COALESCE(?, display_name) WHERE lower(email) = ?")
          .bind(userId, finalDisplayName, email)
          .run()
      }

      await db
        .prepare(
          `INSERT INTO auth_credentials (user_id, password_hash, created_at, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .bind(userId, passwordHash)
        .run()
    } else {
      await db
        .prepare(
          `INSERT INTO user_list (auth_user_id, email, display_name, created_at)
           VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
        )
        .bind(userId, email, finalDisplayName)
        .run()

      await db
        .prepare(
          `INSERT INTO auth_credentials (user_id, password_hash, created_at, updated_at)
           VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .bind(userId, passwordHash)
        .run()
    }

    const token = createSessionToken(userId)
    const response = NextResponse.json({
      success: true,
      user: {
        id: userId,
        email,
        display_name: finalDisplayName,
      },
    })
    setSessionCookie(response, token, undefined, request)
    return response
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to register",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
