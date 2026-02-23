import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim().toLowerCase()
  return trimmed.length > 0 ? trimmed : null
}

async function runAll(db: any, statements: any[]) {
  if (typeof db.batch === "function") {
    await db.batch(statements)
    return
  }

  for (const statement of statements) {
    await statement.run()
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = requireD1Database()
    const body = (await request.json().catch(() => null)) as { email?: unknown } | null
    const email = normalizeEmail(body?.email)

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    const user = (await db
      .prepare(
        `SELECT auth_user_id AS user_id, email
         FROM user_list
         WHERE lower(email) = ?
         LIMIT 1`
      )
      .bind(email)
      .first()) as { user_id: string | null; email: string | null } | null

    if (!user?.user_id) {
      return NextResponse.json({ success: false, error: "User not found with this email" }, { status: 404 })
    }

    const userId = user.user_id
    const statements = [
      db.prepare("DELETE FROM auth_credentials WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM admin_users WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM reading_list_full WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM study_notes WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM book_notes WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM book_highlights WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM custom_outline WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM ai_book_analysis WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM book_tracking WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM book_clicks WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM login_tracking WHERE user_id = ?").bind(userId),
      db.prepare("DELETE FROM user_list WHERE auth_user_id = ?").bind(userId),
    ]

    await runAll(db, statements)

    return NextResponse.json({
      success: true,
      message: `User ${email} deleted successfully`,
      userId,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
