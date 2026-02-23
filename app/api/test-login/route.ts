import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const origin = new URL(request.url).origin
    const body = await request.json().catch(() => ({}))

    const response = await fetch(`${origin}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const result = await response.json().catch(() => null)

    return NextResponse.json({
      success: !!result?.success,
      error: result?.error || null,
      user: result?.user
        ? {
            id: result.user.id,
            email: result.user.email,
            confirmed: true,
            created: null,
          }
        : null,
    }, { status: response.status })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }, { status: 500 })
  }
}
