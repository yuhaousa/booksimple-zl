import { NextRequest, NextResponse } from "next/server"

import { ensureAuthTables } from "@/lib/server/auth-db"
import { consumeAuthToken } from "@/lib/server/auth-tokens"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token")?.trim()
  if (!token) {
    return NextResponse.redirect(`${request.nextUrl.origin}/login?error=confirmation_failed`)
  }

  try {
    const db = requireD1Database()
    await ensureAuthTables(db)

    const payload = await consumeAuthToken(db, token, "verify_email")
    if (!payload) {
      return NextResponse.redirect(`${request.nextUrl.origin}/login?error=confirmation_failed`)
    }

    await db
      .prepare("UPDATE user_list SET email_verified_at = COALESCE(email_verified_at, CURRENT_TIMESTAMP) WHERE auth_user_id = ?")
      .bind(payload.user_id)
      .run()

    return NextResponse.redirect(`${request.nextUrl.origin}/login?confirmed=true`)
  } catch {
    return NextResponse.redirect(`${request.nextUrl.origin}/login?error=confirmation_failed`)
  }
}
