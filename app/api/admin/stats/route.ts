import { NextRequest, NextResponse } from "next/server"

import { getD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000 // UTC+8 Singapore

// Generate last N days as YYYY-MM-DD strings in Singapore time
function lastNDays(n: number): string[] {
  const days: string[] = []
  const nowSgt = new Date(Date.now() + SGT_OFFSET_MS)
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(nowSgt.getTime() - i * 24 * 60 * 60 * 1000)
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

export async function GET(request: NextRequest) {
  const db = getD1Database()
  if (!db) {
    return NextResponse.json({ error: "D1 not configured" }, { status: 503 })
  }

  const userId = normalizeValue(resolveSessionUserIdFromRequest(request))
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const adminRow = (await db
      .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first()) as { user_id: string } | null

    if (!adminRow) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  } catch {
    return NextResponse.json({ error: "Failed to verify admin" }, { status: 500 })
  }

  const days = lastNDays(14)

  try {
    const dayFilter = `date('now', '+8 hours', '-13 days')`

    const [booksResult, loginsResult, highlightsResult, notesResult] = await Promise.all([
      db
        .prepare(
          `SELECT date(created_at, '+8 hours') AS day, COUNT(*) AS count
           FROM books
           WHERE date(created_at, '+8 hours') >= ${dayFilter}
           GROUP BY day`
        )
        .all() as Promise<{ results: { day: string; count: number }[] }>,
      db
        .prepare(
          `SELECT date(logged_in_at, '+8 hours') AS day, COUNT(*) AS count
           FROM login_log
           WHERE date(logged_in_at, '+8 hours') >= ${dayFilter}
           GROUP BY day`
        )
        .all()
        .catch(() => ({ results: [] })) as Promise<{ results: { day: string; count: number }[] }>,
      db
        .prepare(
          `SELECT date(created_at, '+8 hours') AS day, COUNT(*) AS count
           FROM book_highlights
           WHERE date(created_at, '+8 hours') >= ${dayFilter}
           GROUP BY day`
        )
        .all()
        .catch(() => ({ results: [] })) as Promise<{ results: { day: string; count: number }[] }>,
      db
        .prepare(
          `SELECT date(created_at, '+8 hours') AS day, COUNT(*) AS count
           FROM book_notes
           WHERE date(created_at, '+8 hours') >= ${dayFilter}
           GROUP BY day`
        )
        .all()
        .catch(() => ({ results: [] })) as Promise<{ results: { day: string; count: number }[] }>,
    ])

    const booksMap: Record<string, number> = {}
    for (const row of booksResult.results ?? []) booksMap[row.day] = Number(row.count)

    const loginsMap: Record<string, number> = {}
    for (const row of loginsResult.results ?? []) loginsMap[row.day] = Number(row.count)

    const highlightsMap: Record<string, number> = {}
    for (const row of highlightsResult.results ?? []) highlightsMap[row.day] = Number(row.count)

    const notesMap: Record<string, number> = {}
    for (const row of notesResult.results ?? []) notesMap[row.day] = Number(row.count)

    const data = days.map((day) => ({
      day: day.slice(5), // MM-DD
      date: day,
      booksAdded: booksMap[day] ?? 0,
      logins: loginsMap[day] ?? 0,
      highlights: highlightsMap[day] ?? 0,
      readingNotes: notesMap[day] ?? 0,
    }))

    return NextResponse.json({ success: true, data })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load stats", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
