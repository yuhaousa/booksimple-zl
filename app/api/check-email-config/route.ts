import { NextResponse } from "next/server"

export async function GET() {
  return NextResponse.json({
    success: true,
    system: "D1/R2",
    message: "Legacy Supabase email configuration route has been retired.",
    authentication: "Custom D1 auth is active",
  })
}
