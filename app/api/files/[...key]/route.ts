import { NextRequest, NextResponse } from "next/server"

import { requireR2Bucket } from "@/lib/server/cloudflare-bindings"

function decodeKey(segments: string[] | undefined) {
  if (!segments || segments.length === 0) return null
  return segments.map((segment) => decodeURIComponent(segment)).join("/")
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> }
) {
  try {
    const bucket = requireR2Bucket()
    const { key: pathSegments } = await params
    const key = decodeKey(pathSegments)

    if (!key) {
      return NextResponse.json({ success: false, error: "File key is required" }, { status: 400 })
    }

    const rangeHeader = request.headers.get("range")
    const object = rangeHeader
      ? await bucket.get(key, { range: request.headers })
      : await bucket.get(key)

    if (!object) {
      return NextResponse.json({ success: false, error: "File not found" }, { status: 404 })
    }

    const headers = new Headers()
    object.writeHttpMetadata(headers)
    headers.set("etag", object.httpEtag)
    headers.set("accept-ranges", "bytes")
    headers.set("cache-control", "public, max-age=3600")

    const range = (object as any).range as { offset: number; length: number } | undefined
    if (range) {
      headers.set("content-range", `bytes ${range.offset}-${range.offset + range.length - 1}/${object.size}`)
      headers.set("content-length", String(range.length))
    } else {
      headers.set("content-length", String(object.size))
    }

    return new Response(object.body, {
      status: range ? 206 : 200,
      headers,
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to read file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
