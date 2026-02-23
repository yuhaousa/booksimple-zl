import { NextRequest, NextResponse } from "next/server"

import { clearSessionCookie } from "@/lib/server/session"

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true })
  clearSessionCookie(response, request)
  return response
}
