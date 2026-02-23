import { NextRequest, NextResponse } from "next/server"

import { ensureAuthTables, normalizeEmail, normalizeValue } from "@/lib/server/auth-db"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { hashPassword, verifyPassword } from "@/lib/server/password"
import { createSessionToken, setSessionCookie } from "@/lib/server/session"

type LoginRow = {
  user_id: string
  email: string | null
  display_name: string | null
  password_hash: string | null
}

const DEFAULT_USER_ID = process.env.DEFAULT_AUTH_USER_ID?.trim() || "00000000-0000-0000-0000-000000000001"
const DEFAULT_EMAIL = normalizeEmail(process.env.DEFAULT_AUTH_EMAIL) || "admin@booksimple.local"
const DEFAULT_PASSWORD = normalizeValue(process.env.DEFAULT_AUTH_PASSWORD) || "Admin123456!"
const DEFAULT_DISPLAY_NAME = normalizeValue(process.env.DEFAULT_AUTH_DISPLAY_NAME) || "Default Admin"

async function ensureBootstrapUser(db: any) {
  const existing = (await db
    .prepare(`SELECT auth_user_id FROM user_list WHERE lower(email) = ? LIMIT 1`)
    .bind(DEFAULT_EMAIL)
    .first()) as { auth_user_id: string | null } | null

  let userId = existing?.auth_user_id || DEFAULT_USER_ID

  if (!existing) {
    await db
      .prepare(
        `INSERT INTO user_list (auth_user_id, email, display_name, created_at)
         VALUES (?, ?, ?, CURRENT_TIMESTAMP)`
      )
      .bind(userId, DEFAULT_EMAIL, DEFAULT_DISPLAY_NAME)
      .run()
  } else if (!existing.auth_user_id) {
    await db
      .prepare("UPDATE user_list SET auth_user_id = ? WHERE lower(email) = ?")
      .bind(userId, DEFAULT_EMAIL)
      .run()
  }

  const existingCredential = (await db
    .prepare("SELECT user_id FROM auth_credentials WHERE user_id = ? LIMIT 1")
    .bind(userId)
    .first()) as { user_id: string } | null

  if (!existingCredential) {
    const passwordHash = await hashPassword(DEFAULT_PASSWORD)
    await db
      .prepare(
        `INSERT INTO auth_credentials (user_id, password_hash, created_at, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      )
      .bind(userId, passwordHash)
      .run()
  }

  try {
    const existingAdmin = (await db
      .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first()) as { user_id: string } | null

    if (!existingAdmin) {
      await db
        .prepare("INSERT INTO admin_users (user_id, created_at) VALUES (?, CURRENT_TIMESTAMP)")
        .bind(userId)
        .run()
    }
  } catch {
    // Ignore when admin table is not present in some environments.
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    await ensureAuthTables(db)
    await ensureBootstrapUser(db)

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
