import { NextRequest, NextResponse } from "next/server"

import { requireR2Bucket } from "@/lib/server/cloudflare-bindings"
import { toAssetUrl } from "@/lib/server/storage"

const ALLOWED_KINDS = new Set(["book-cover", "book-file", "video-file"])

function sanitizeFileName(name: string) {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return base || "file"
}

function getObjectKey(kind: string, fileName: string) {
  const safeName = sanitizeFileName(fileName)
  const random = Math.random().toString(36).slice(2, 10)
  return `${kind}/${Date.now()}-${random}-${safeName}`
}

export async function POST(request: NextRequest) {
  try {
    const bucket = requireR2Bucket()
    const formData = await request.formData()

    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, error: "file is required" }, { status: 400 })
    }

    const rawKind = typeof formData.get("kind") === "string" ? String(formData.get("kind")) : "book-file"
    const kind = rawKind.trim().toLowerCase()
    if (!ALLOWED_KINDS.has(kind)) {
      return NextResponse.json(
        { success: false, error: `Invalid kind. Allowed: ${Array.from(ALLOWED_KINDS).join(", ")}` },
        { status: 400 }
      )
    }

    const key = getObjectKey(kind, file.name || "upload.bin")
    const data = await file.arrayBuffer()

    await bucket.put(key, data, {
      httpMetadata: {
        contentType: file.type || undefined,
      },
      customMetadata: {
        originalFilename: file.name || "",
      },
    })

    return NextResponse.json({
      success: true,
      key,
      url: toAssetUrl(key),
      size: file.size,
      contentType: file.type || "application/octet-stream",
    })
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Failed to upload file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}
