import { NextRequest, NextResponse } from "next/server"

import { ensureAuthTables, getAuthEmailMatches, hasPasswordCredential, normalizeEmail, normalizeValue } from "@/lib/server/auth-db"
import { issueAuthToken } from "@/lib/server/auth-tokens"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { sendResendEmail } from "@/lib/server/resend-email"

function verificationEmailHtml(displayName: string | null, verifyUrl: string) {
  const greeting = displayName ? `Hi ${displayName},` : "Hi,"
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h2 style="color:#2d5038;">Verify your email</h2>
    <p>${greeting}</p>
    <p>Use the link below to verify your Book365 account.</p>
    <p style="margin:24px 0;">
      <a href="${verifyUrl}" style="display:inline-block;background:#2d5038;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;">Verify email address</a>
    </p>
    <p style="word-break:break-all;color:#6b7280;font-size:14px;">${verifyUrl}</p>
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
          !normalizeValue(match.email_verified_at)
      ) ?? null

    if (!row) {
      return NextResponse.json({
        success: true,
        message: "If that account exists, a verification email has been sent.",
      })
    }

    const userId = normalizeValue(row.auth_user_id)
    if (!userId) {
      return NextResponse.json({
        success: true,
        message: "If that account exists, a verification email has been sent.",
      })
    }

    const { token } = await issueAuthToken(db, {
      userId,
      email,
      type: "verify_email",
      ttlMinutes: 60 * 24,
    })

    const verifyUrl = `${request.nextUrl.origin}/api/auth/verify-email?token=${encodeURIComponent(token)}`
    await sendResendEmail(db, {
      to: email,
      subject: "Verify your Book365 email address",
      html: verificationEmailHtml(normalizeValue(row.display_name), verifyUrl),
    })

    return NextResponse.json({
      success: true,
      message: "Verification email sent.",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to resend verification email",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
