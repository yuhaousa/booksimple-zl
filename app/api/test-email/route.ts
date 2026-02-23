import { NextRequest, NextResponse } from "next/server"

export async function GET(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    deprecated: true,
    error: "Legacy Supabase test-email route has been retired.",
    use: ["POST /api/auth/register"],
  }, { status: 410 })
}
