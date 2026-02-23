import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const origin = requestUrl.origin

  // Legacy Supabase callback endpoint kept for backward-compatible links.
  return NextResponse.redirect(`${origin}/login?error=legacy_auth_callback`)
}
