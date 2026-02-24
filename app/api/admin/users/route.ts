import { NextRequest, NextResponse } from "next/server"

import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

type AdminUserRow = {
  user_id: string
  created_at: string | null
}

type UserListRow = {
  user_id: string
  email: string | null
  display_name: string | null
  created_at: string | null
}

type BookStatsRow = {
  user_id: string
  book_count: number | string
  last_book_at: string | null
}

type NoteStatsRow = {
  user_id: string
  note_count: number | string
  last_note_at: string | null
}

type LoginStatsRow = {
  user_id: string
  total_logins: number | string
  last_login_at: string | null
  first_login_at: string | null
}

type CombinedUser = {
  id: string
  email: string
  username: string
  full_name: string
  display_name: string
  created_at: string
  last_sign_in_at: string | null
  total_logins: number
  first_login_at: string | null
  book_count: number
  note_count: number
  last_activity: string
}

function asNonEmptyString(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function asNumber(value: unknown) {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoOrNow(value: string | null | undefined) {
  if (value && Number.isFinite(Date.parse(value))) return value
  return new Date(0).toISOString()
}

function mostRecentTimestamp(...values: (string | null | undefined)[]) {
  let winner = toIsoOrNow(null)
  for (const value of values) {
    if (!value || !Number.isFinite(Date.parse(value))) continue
    if (Date.parse(value) > Date.parse(winner)) winner = value
  }
  return winner
}

function usernameFromEmail(email: string) {
  const at = email.indexOf("@")
  if (at <= 0) return email
  return email.slice(0, at)
}

function resolveAuthenticatedUserId(request: NextRequest) {
  return asNonEmptyString(resolveSessionUserIdFromRequest(request))
}

async function isAdminUser(db: any, requesterUserId: string) {
  const row = (await db
    .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
    .bind(requesterUserId)
    .first()) as { user_id: string } | null

  return !!row
}

export async function GET(request: NextRequest) {
  try {
    const db = requireD1Database()
    const requesterUserId = resolveAuthenticatedUserId(request)
    if (!requesterUserId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = await isAdminUser(db, requesterUserId)
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const [adminResult, userListResult, bookStatsResult, noteStatsResult, loginStatsResult] = await Promise.all([
      db
        .prepare("SELECT user_id, created_at FROM admin_users ORDER BY datetime(created_at) DESC")
        .all() as Promise<{ results?: AdminUserRow[] }>,
      db
        .prepare(
          "SELECT auth_user_id AS user_id, email, display_name, created_at FROM user_list WHERE auth_user_id IS NOT NULL"
        )
        .all() as Promise<{ results?: UserListRow[] }>,
      db
        .prepare(
          `SELECT user_id, COUNT(*) AS book_count, MAX(created_at) AS last_book_at
           FROM "Booklist"
           WHERE user_id IS NOT NULL AND TRIM(user_id) <> ''
           GROUP BY user_id`
        )
        .all() as Promise<{ results?: BookStatsRow[] }>,
      db
        .prepare(
          `SELECT user_id, COUNT(*) AS note_count, MAX(created_at) AS last_note_at
           FROM study_notes
           WHERE user_id IS NOT NULL AND TRIM(user_id) <> ''
           GROUP BY user_id`
        )
        .all() as Promise<{ results?: NoteStatsRow[] }>,
      db
        .prepare(
          `SELECT user_id, COUNT(*) AS total_logins, MAX(login_timestamp) AS last_login_at, MIN(login_timestamp) AS first_login_at
           FROM login_tracking
           WHERE user_id IS NOT NULL AND TRIM(user_id) <> ''
           GROUP BY user_id`
        )
        .all() as Promise<{ results?: LoginStatsRow[] }>,
    ])

    const adminUsers = adminResult.results ?? []
    const userRows = userListResult.results ?? []
    const bookStats = bookStatsResult.results ?? []
    const noteStats = noteStatsResult.results ?? []
    const loginStats = loginStatsResult.results ?? []

    const byUserId = new Map<string, CombinedUser>()

    for (const row of userRows) {
      const userId = asNonEmptyString(row.user_id)
      if (!userId) continue
      const email = asNonEmptyString(row.email) ?? `${userId.slice(0, 8)}@unknown.local`
      const displayName = asNonEmptyString(row.display_name) ?? usernameFromEmail(email)
      const createdAt = toIsoOrNow(row.created_at)

      byUserId.set(userId, {
        id: userId,
        email,
        username: displayName,
        full_name: displayName,
        display_name: displayName,
        created_at: createdAt,
        last_sign_in_at: null,
        total_logins: 0,
        first_login_at: null,
        book_count: 0,
        note_count: 0,
        last_activity: createdAt,
      })
    }

    for (const row of bookStats) {
      const userId = asNonEmptyString(row.user_id)
      if (!userId) continue
      const existing =
        byUserId.get(userId) ??
        ({
          id: userId,
          email: `${userId.slice(0, 8)}@unknown.local`,
          username: `User ${userId.slice(0, 8)}`,
          full_name: `User ${userId.slice(0, 8)}`,
          display_name: `User ${userId.slice(0, 8)}`,
          created_at: toIsoOrNow(row.last_book_at),
          last_sign_in_at: null,
          total_logins: 0,
          first_login_at: null,
          book_count: 0,
          note_count: 0,
          last_activity: toIsoOrNow(row.last_book_at),
        } satisfies CombinedUser)

      existing.book_count = asNumber(row.book_count)
      existing.last_activity = mostRecentTimestamp(existing.last_activity, row.last_book_at)
      byUserId.set(userId, existing)
    }

    for (const row of noteStats) {
      const userId = asNonEmptyString(row.user_id)
      if (!userId) continue
      const existing =
        byUserId.get(userId) ??
        ({
          id: userId,
          email: `${userId.slice(0, 8)}@unknown.local`,
          username: `User ${userId.slice(0, 8)}`,
          full_name: `User ${userId.slice(0, 8)}`,
          display_name: `User ${userId.slice(0, 8)}`,
          created_at: toIsoOrNow(row.last_note_at),
          last_sign_in_at: null,
          total_logins: 0,
          first_login_at: null,
          book_count: 0,
          note_count: 0,
          last_activity: toIsoOrNow(row.last_note_at),
        } satisfies CombinedUser)

      existing.note_count = asNumber(row.note_count)
      existing.last_activity = mostRecentTimestamp(existing.last_activity, row.last_note_at)
      byUserId.set(userId, existing)
    }

    for (const row of loginStats) {
      const userId = asNonEmptyString(row.user_id)
      if (!userId) continue
      const existing =
        byUserId.get(userId) ??
        ({
          id: userId,
          email: `${userId.slice(0, 8)}@unknown.local`,
          username: `User ${userId.slice(0, 8)}`,
          full_name: `User ${userId.slice(0, 8)}`,
          display_name: `User ${userId.slice(0, 8)}`,
          created_at: toIsoOrNow(row.first_login_at ?? row.last_login_at),
          last_sign_in_at: null,
          total_logins: 0,
          first_login_at: null,
          book_count: 0,
          note_count: 0,
          last_activity: toIsoOrNow(row.last_login_at),
        } satisfies CombinedUser)

      existing.total_logins = asNumber(row.total_logins)
      existing.first_login_at = row.first_login_at ?? null
      existing.last_sign_in_at = row.last_login_at ?? null
      existing.last_activity = mostRecentTimestamp(existing.last_activity, row.last_login_at)
      byUserId.set(userId, existing)
    }

    const users = Array.from(byUserId.values()).sort(
      (a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || "")
    )

    return NextResponse.json({
      success: true,
      users,
      adminUsers,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch admin users",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    const requesterUserId = resolveAuthenticatedUserId(request)
    if (!requesterUserId) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const isAdmin = await isAdminUser(db, requesterUserId)
    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json().catch(() => null)) as { userId?: unknown } | null
    const userId = asNonEmptyString(body?.userId)
    if (!userId) {
      return NextResponse.json({ success: false, error: "userId is required" }, { status: 400 })
    }

    await db
      .prepare(
        `INSERT INTO admin_users (user_id, created_at)
         VALUES (?, CURRENT_TIMESTAMP)
         ON CONFLICT(user_id) DO NOTHING`
      )
      .bind(userId)
      .run()

    return NextResponse.json({
      success: true,
      message: "Admin user added",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to add admin user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
