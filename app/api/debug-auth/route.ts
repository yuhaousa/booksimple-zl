import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    success: false,
    deprecated: true,
    error: "Legacy Supabase debug-auth route has been retired.",
    use: ["GET /api/auth/me"],
  }, { status: 410 })
}
