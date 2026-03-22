import { NextRequest, NextResponse } from "next/server"

import { ensureAuthTables, getAuthEmailMatches, hasPasswordCredential, normalizeEmail, normalizeValue } from "@/lib/server/auth-db"
import { issueAuthToken } from "@/lib/server/auth-tokens"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { sendResendEmail } from "@/lib/server/resend-email"

function resetPasswordEmailHtml(displayName: string | null, resetUrl: string) {
  const greeting = displayName ? `Hi ${displayName},` : "Hi,"
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h2 style="color:#2d5038;">Reset your password</h2>
    <p>${greeting}</p>
    <p>We received a request to reset your Book365 password.</p>
    <p style="margin:24px 0;">
      <a href="${resetUrl}" style="display:inline-block;background:#2d5038;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;">Reset password</a>
    </p>
    <p style="word-break:break-all;color:#6b7280;font-size:14px;">${resetUrl}</p>
    <p style="color:#6b7280;font-size:12px;">This link expires in 60 minutes.</p>
  </div>`
}

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    await ensureAuthTables(db)

    const body = (await request.json().catch(() => null)) as { email?: unknown } | null
    const email = normalizeEmail(body?.email)

    if (!email) {
      return NextResponse.json({ success: false, error: "Email is required" }, { status: 400 })
    }

    const row =
      (await getAuthEmailMatches(db, email)).find(
        (match) =>
          normalizeValue(match.auth_user_id) &&
          hasPasswordCredential(match) &&
          (Number(match.verification_required ?? 0) === 0 || !!normalizeValue(match.email_verified_at))
      ) ?? null

    if (row) {
      const userId = normalizeValue(row.auth_user_id)
      if (userId) {
        const { token } = await issueAuthToken(db, {
          userId,
          email,
          type: "reset_password",
          ttlMinutes: 60,
        })

        const resetUrl = `${request.nextUrl.origin}/reset-password?token=${encodeURIComponent(token)}`
        await sendResendEmail(db, {
          to: email,
          subject: "Reset your Book365 password",
          html: resetPasswordEmailHtml(normalizeValue(row.display_name), resetUrl),
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: "If that email exists, a password reset link has been sent.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to start password reset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

