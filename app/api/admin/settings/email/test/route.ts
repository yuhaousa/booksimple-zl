import { NextRequest, NextResponse } from "next/server"

import { getD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveSessionUserIdFromRequest } from "@/lib/server/session"

function normalizeValue(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

async function requireAdminAccess(request: NextRequest) {
  const db = getD1Database()
  if (!db) {
    return { error: NextResponse.json({ error: "D1 not configured" }, { status: 503 }), db: null, userId: null }
  }
  const userId = normalizeValue(resolveSessionUserIdFromRequest(request))
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }), db: null, userId: null }
  }
  try {
    const adminRow = (await db
      .prepare("SELECT user_id FROM admin_users WHERE user_id = ? LIMIT 1")
      .bind(userId)
      .first()) as { user_id: string } | null
    if (!adminRow) {
      return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }), db: null, userId: null }
    }
  } catch (error) {
    return {
      error: NextResponse.json(
        { error: "Failed to verify admin", details: error instanceof Error ? error.message : "Unknown" },
        { status: 500 }
      ),
      db: null,
      userId: null,
    }
  }
  return { db, userId, error: null }
}

export async function POST(request: NextRequest) {
  const access = await requireAdminAccess(request)
  if (access.error) return access.error

  const { db } = access

  try {
    const rows = (await db
      .prepare(
        `SELECT setting_key, setting_value FROM admin_settings
         WHERE setting_key IN ('email_resend_api_key','email_from','email_from_name','email_to')`
      )
      .all()) as { results: { setting_key: string; setting_value: string }[] }

    const map: Record<string, string> = {}
    for (const row of rows.results ?? []) {
      map[row.setting_key] = row.setting_value
    }

    const apiKey = map["email_resend_api_key"]
    const from = map["email_from"]
    const fromName = map["email_from_name"] || "Book365"
    const to = map["email_to"]

    if (!apiKey) {
      return NextResponse.json({ error: "Resend API key not configured." }, { status: 400 })
    }
    if (!from) {
      return NextResponse.json({ error: "From email address not configured." }, { status: 400 })
    }
    if (!to) {
      return NextResponse.json({ error: "Recipient email address not configured." }, { status: 400 })
    }

    // Resend HTTP API — works in Cloudflare Workers
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${fromName} <${from}>`,
        to: [to],
        subject: "Test Email from Book365 Admin",
        html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
          <h2 style="color:#2d5038;">Test Email</h2>
          <p>This is a test email sent from your <strong>Book365</strong> admin settings.</p>
          <p>Your Resend email configuration is working correctly.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
          <p style="color:#6b7280;font-size:12px;">Sent via Resend API · from ${from}</p>
        </div>`,
      }),
    })

    const result = await res.json().catch(() => null)

    if (!res.ok) {
      const detail = result?.message || result?.name || `HTTP ${res.status}`
      return NextResponse.json({ error: "Resend rejected the request", details: detail }, { status: 502 })
    }

    return NextResponse.json({ success: true, message: `Test email sent to ${to}` })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to send test email", details: error instanceof Error ? error.message : "Unknown" },
      { status: 500 }
    )
  }
}
