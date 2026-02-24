import { createHash } from "crypto"
import { NextRequest, NextResponse } from "next/server"

import { createConfiguredOpenAIClient } from "@/lib/server/openai-config"
import { requireD1Database } from "@/lib/server/cloudflare-bindings"
import { resolveUserIdFromRequest } from "@/lib/server/request-user"

function parsePositiveInt(value: unknown) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return null
  return parsed
}

function parseJsonValue<T = any>(value: unknown): T | null {
  if (!value) return null
  if (typeof value !== "string") return value as T
  try {
    return JSON.parse(value) as T
  } catch {
    return null
  }
}

function asString(value: unknown) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}_${crypto.randomUUID()}`
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
}

export async function POST(request: NextRequest) {
  try {
    const db = requireD1Database()
    const body = (await request.json().catch(() => null)) as
      | {
          bookId?: unknown
          userId?: unknown
          forceRegenerate?: unknown
        }
      | null

    const bookId = parsePositiveInt(body?.bookId)
    if (!bookId) {
      return NextResponse.json({ error: "Missing or invalid bookId" }, { status: 400 })
    }

    const userId = resolveUserIdFromRequest(request, body?.userId)
    const forceRegenerate = Boolean(body?.forceRegenerate)

    if (!forceRegenerate) {
      const cached = (await db
        .prepare(
          `SELECT id, summary, mind_map_data
           FROM ai_book_analysis
           WHERE book_id = ?
           ORDER BY datetime(last_accessed_at) DESC, datetime(created_at) DESC
           LIMIT 1`
        )
        .bind(bookId)
        .first()) as
        | {
            id: string
            summary: string | null
            mind_map_data: string | null
          }
        | null

      if (cached?.mind_map_data) {
        await db
          .prepare("UPDATE ai_book_analysis SET last_accessed_at = CURRENT_TIMESTAMP WHERE id = ?")
          .bind(cached.id)
          .run()

        return NextResponse.json({
          success: true,
          cached: true,
          data: {
            summary: cached.summary,
            mindMapData: parseJsonValue(cached.mind_map_data),
          },
        })
      }
    }

    const book = (await db
      .prepare('SELECT id, title, author, description, file_url FROM "Booklist" WHERE id = ? LIMIT 1')
      .bind(bookId)
      .first()) as
      | {
          id: number
          title: string
          author: string | null
          description: string | null
          file_url: string | null
        }
      | null

    if (!book) {
      return NextResponse.json({ error: "Book not found" }, { status: 404 })
    }

    const { client: openai, model, provider } = await createConfiguredOpenAIClient({
      openaiModel: "gpt-4o-mini",
      minimaxModel: "MiniMax-M2.5",
    })

    if (!openai) {
      return NextResponse.json(
        { error: "AI provider key is not configured. Set provider key in env vars or Admin Settings." },
        { status: 503 }
      )
    }

    const prompt = [
      `Create a mind map structure for the book titled "${book.title}".`,
      book.author ? `Author: ${book.author}` : null,
      book.description ? `Description: ${book.description}` : null,
      "Return strictly valid JSON with this shape:",
      '{"chapters":[{"title":"...","sections":["..."],"key_points":["..."]}],"key_concepts":["..."],"main_themes":["..."]}',
      "Rules: 3-5 chapters, 2-4 sections per chapter, and 2-3 key points per chapter.",
    ]
      .filter(Boolean)
      .join("\n")

    const mindMapCompletion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a professional book analyst. Return only valid JSON without markdown fences.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.5,
      response_format: { type: "json_object" },
    })

    const rawMindMap = asString(mindMapCompletion.choices[0]?.message?.content)
    if (!rawMindMap) {
      throw new Error("No response from AI provider")
    }

    let mindMapData: Record<string, unknown>
    try {
      mindMapData = JSON.parse(rawMindMap)
    } catch {
      throw new Error("AI provider returned invalid JSON")
    }

    let summary = asString((mindMapData as any)?.summary)
    if (!summary) {
      const summaryInput = [
        `Title: ${book.title}`,
        book.author ? `Author: ${book.author}` : null,
        book.description ? `Description: ${book.description}` : null,
      ]
        .filter(Boolean)
        .join("\n")

      const summaryCompletion = await openai.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content:
              "Write concise, useful reading guide summaries for books. Use only provided facts. If details are missing, state uncertainty instead of inventing.",
          },
          {
            role: "user",
            content: `Write a 180-240 word reading guide summary in the same language as the source details.\n\n${summaryInput}`,
          },
        ],
        temperature: 0.6,
        max_tokens: 400,
      })

      summary =
        asString(summaryCompletion.choices[0]?.message?.content) ||
        `A structured reading guide for "${book.title}".`
    }

    const contentHash = createHash("sha256")
      .update(`${book.title}|${book.author || ""}|${book.description || ""}|${book.file_url || ""}`)
      .digest("hex")

    const rowId = makeId("ai")
    const now = new Date().toISOString()

    await db
      .prepare(
        `INSERT INTO ai_book_analysis
          (id, book_id, user_id, summary, content_analysis, mind_map_data, content_hash, ai_model_used, analysis_version, created_at, updated_at, last_accessed_at)
         VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, '1.0', ?, ?, ?)
         ON CONFLICT(book_id, content_hash)
         DO UPDATE SET
          user_id = excluded.user_id,
          summary = excluded.summary,
          content_analysis = excluded.content_analysis,
          mind_map_data = excluded.mind_map_data,
          ai_model_used = excluded.ai_model_used,
          updated_at = excluded.updated_at,
          last_accessed_at = excluded.last_accessed_at`
      )
      .bind(
        rowId,
        bookId,
        userId,
        summary,
        JSON.stringify({ mindMapOnly: true, generatedAt: now }),
        JSON.stringify(mindMapData),
        contentHash,
        `${provider}:${model}`,
        now,
        now,
        now
      )
      .run()

    return NextResponse.json({
      success: true,
      cached: false,
      data: {
        summary,
        mindMapData,
      },
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to generate mind map" },
      { status: 500 }
    )
  }
}
