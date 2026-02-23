import { NextRequest, NextResponse } from "next/server"

export async function POST(_request: NextRequest) {
  return NextResponse.json({
    success: false,
    deprecated: true,
    error: "Email confirmation sending is no longer required with D1 auth.",
  }, { status: 410 })
}
