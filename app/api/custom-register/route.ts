import { NextRequest, NextResponse } from "next/server"

import { ensureAuthTables, getAuthEmailMatches, hasPasswordCredential, normalizeEmail, normalizeValue } from "@/lib/server/auth-db"
import { issueAuthToken } from "@/lib/server/auth-tokens"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { hashPassword } from "@/lib/server/password"
import { sendResendEmail } from "@/lib/server/resend-email"

function verificationEmailHtml(displayName: string | null, verifyUrl: string) {
  const greeting = displayName ? `Hi ${displayName},` : "Hi,"
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
    <h2 style="color:#2d5038;">Verify your email</h2>
    <p>${greeting}</p>
    <p>Verify your email address before signing in to Book365.</p>
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
      return NextResponse.json({ success: false, error: "Email and password are required" }, { status: 400 })
    }

    if (password.length < 8) {
      return NextResponse.json({ success: false, error: "Password must be at least 8 characters" }, { status: 400 })
    }

    const emailMatches = await getAuthEmailMatches(db, email)
    const registeredMatch = emailMatches.find(
      (row) =>
        normalizeValue(row.auth_user_id) &&
        hasPasswordCredential(row) &&
        Number(row.verification_required ?? 0) === 0
    )

    if (registeredMatch) {
      return NextResponse.json({ success: false, error: "User with this email already exists" }, { status: 409 })
    }

    const pendingMatch = emailMatches.find((row) => normalizeValue(row.auth_user_id) && hasPasswordCredential(row)) ?? null
    const existing = pendingMatch ?? emailMatches.find((row) => normalizeValue(row.auth_user_id)) ?? emailMatches[0] ?? null
    const userId = existing ? normalizeValue(existing.auth_user_id) || crypto.randomUUID() : crypto.randomUUID()
    const finalDisplayName = existing ? displayName ?? normalizeValue(existing.display_name) ?? null : displayName

    if (pendingMatch) {
      // Keep the existing pending account and just issue a fresh verification email.
    } else if (existing) {
      const passwordHash = await hashPassword(password)
      if (normalizeValue(existing.auth_user_id)) {
        await db
          .prepare(
            "UPDATE user_list SET display_name = COALESCE(?, display_name), email_verified_at = NULL, verification_required = 1 WHERE id = ?"
          )
          .bind(finalDisplayName, existing.id)
          .run()
      } else {
        await db
          .prepare(
            "UPDATE user_list SET auth_user_id = ?, display_name = COALESCE(?, display_name), email_verified_at = NULL, verification_required = 1 WHERE id = ?"
          )
          .bind(userId, finalDisplayName, existing.id)
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
      const passwordHash = await hashPassword(password)
      await db
        .prepare(
          `INSERT INTO user_list (auth_user_id, email, display_name, email_verified_at, verification_required, created_at)
           VALUES (?, ?, ?, NULL, 1, CURRENT_TIMESTAMP)`
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
      html: verificationEmailHtml(finalDisplayName, verifyUrl),
    })

    return NextResponse.json({
      success: true,
      requiresVerification: true,
      email,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Registration failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
