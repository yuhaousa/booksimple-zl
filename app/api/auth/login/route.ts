import { NextRequest, NextResponse } from "next/server"

import { ensureAuthTables, normalizeEmail, normalizeValue } from "@/lib/server/auth-db"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { verifyPassword } from "@/lib/server/password"
import { createSessionToken, setSessionCookie } from "@/lib/server/session"

type LoginRow = {
  user_id: string
  email: string | null
  display_name: string | null
  password_hash: string | null
}

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    await ensureAuthTables(db)

    const body = (await request.json().catch(() => null)) as
      | {
          email?: unknown
          password?: unknown
        }
      | null

    const email = normalizeEmail(body?.email)
    const password = normalizeValue(body?.password)

    if (!email || !password) {
      return NextResponse.json({ success: false, error: "email and password are required" }, { status: 400 })
    }

    const row = (await db
      .prepare(
        `SELECT
          u.auth_user_id AS user_id,
          u.email AS email,
          u.display_name AS display_name,
          c.password_hash AS password_hash
        FROM user_list u
        LEFT JOIN auth_credentials c ON c.user_id = u.auth_user_id
        WHERE lower(u.email) = ?
        LIMIT 1`
      )
      .bind(email)
      .first()) as LoginRow | null

    if (!row) {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 })
    }

    if (!row.password_hash) {
      return NextResponse.json(
        {
          success: false,
          error:
            "This account needs to be activated after migration. Please register again with the same email to set a new password.",
        },
        { status: 409 }
      )
    }

    const valid = await verifyPassword(password, row.password_hash)
    if (!valid) {
      return NextResponse.json({ success: false, error: "Invalid email or password" }, { status: 401 })
    }

    const token = createSessionToken(row.user_id)
    const response = NextResponse.json({
      success: true,
      user: {
        id: row.user_id,
        email: row.email,
        display_name: row.display_name,
      },
    })
    setSessionCookie(response, token, undefined, request)
    return response
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to login",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
