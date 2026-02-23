import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    success: false,
    deprecated: true,
    error: "Legacy Supabase auth-test route has been retired.",
    use: ["GET /api/auth/me", "POST /api/auth/login", "POST /api/auth/register"],
  }, { status: 410 })
}
