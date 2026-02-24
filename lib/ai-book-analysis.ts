import { createConfiguredOpenAIClient } from "@/lib/server/openai-config"

export interface QuizQuestion {
  question: string
  options: string[]
  correct: number
  explanation: string
}

export interface AIBookAnalysis {
  summary: string
  detailedSummary?: string
  keyPoints: string[]
  keywords: string[]
  topics: string[]
  readingTime: number
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  authorBackground?: string
  bookBackground?: string
  worldRelevance?: string
  quizQuestions?: QuizQuestion[]
  mindmapData: any
  confidence: number
}

export interface BookContent {
  title: string
  author?: string
  description?: string
  tags?: string
  textContent?: string
  pageCount?: number
}

type ParsedAnalysis = Partial<{
  summary: string
  detailedSummary: string
  keyPoints: string[]
  keywords: string[]
  topics: string[]
  difficulty: string
  authorBackground: string
  bookBackground: string
  worldRelevance: string
  quizQuestions: QuizQuestion[]
  mindmapStructure: any
  confidence: number
}>

function toTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length ? trimmed : null
}

function normalizeStringArray(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  const result = value
    .map((item) => (typeof item === "string" ? item.trim() : String(item).trim()))
    .filter(Boolean)
  return result.slice(0, max)
}

function isCjkText(text: string) {
  return /[\u4e00-\u9fff]/.test(text)
}

function normalizeDifficulty(value: string | null): "Beginner" | "Intermediate" | "Advanced" {
  if (!value) return "Intermediate"
  const normalized = value.toLowerCase()
  if (normalized.includes("beginner")) return "Beginner"
  if (normalized.includes("advanced")) return "Advanced"
  if (normalized.includes("intermediate")) return "Intermediate"
  if (value.includes("\u521d")) return "Beginner"
  if (value.includes("\u9ad8")) return "Advanced"
  if (value.includes("\u4e2d")) return "Intermediate"
  return "Intermediate"
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T
  } catch {
    const start = value.indexOf("{")
    const end = value.lastIndexOf("}")
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(value.slice(start, end + 1)) as T
    } catch {
      return null
    }
  }
}

function extractBookText(bookContent: BookContent): string {
  const parts: string[] = []
  if (bookContent.title) parts.push(`Title: ${bookContent.title}`)
  if (bookContent.author) parts.push(`Author: ${bookContent.author}`)
  if (bookContent.description) parts.push(`Description: ${bookContent.description}`)
  if (bookContent.tags) parts.push(`Tags: ${bookContent.tags}`)
  if (bookContent.textContent) parts.push(`Excerpt: ${bookContent.textContent.slice(0, 8000)}`)
  return parts.join("\n\n")
}

function buildPrompt(sourceText: string) {
  return [
    "Analyze this book based ONLY on the provided content.",
    "Do not invent facts. If information is missing, say 'insufficient information'.",
    "Use the same language as the source text.",
    "",
    sourceText,
    "",
    "Return strict JSON with keys:",
    "{",
    '  "summary": "180-260 words",',
    '  "detailedSummary": "optional, 400-700 words",',
    '  "keyPoints": ["3-6 items"],',
    '  "keywords": ["6-12 items"],',
    '  "topics": ["3-6 items"],',
    '  "difficulty": "Beginner|Intermediate|Advanced",',
    '  "authorBackground": "optional",',
    '  "bookBackground": "optional",',
    '  "worldRelevance": "optional",',
    '  "quizQuestions": [{"question":"","options":["","","",""],"correct":0,"explanation":""}],',
    '  "mindmapStructure": {"name":"","children":[{"name":"","children":[{"name":""}]}]},',
    '  "confidence": 0.0',
    "}",
  ].join("\n")
}

function buildFallbackAnalysis(bookContent: BookContent, readingTime: number, reason?: string): AIBookAnalysis {
  const tags = (bookContent.tags || "")
    .split(/[,\uFF0C\u3001;|/]+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 12)

  const sourceText = `${bookContent.title} ${bookContent.author || ""} ${bookContent.description || ""} ${bookContent.textContent || ""}`
  const cjk = isCjkText(sourceText)

  const summary = cjk
    ? `Current summary is metadata-grounded (title, author, description${bookContent.textContent ? ", plus partial extracted text" : ""}).${
        reason ? ` Analysis was not fully successful: ${reason}.` : ""
      } To avoid hallucinations, the system did not invent chapter-level details. Provide richer extractable text and regenerate.`
    : `This summary is metadata-grounded (title, author, description${bookContent.textContent ? ", plus partial extracted text" : ""}).${
        reason ? ` Analysis was not fully successful: ${reason}.` : ""
      } To avoid hallucinations, the system did not invent chapter-level details. Provide richer extractable text and regenerate.`

  const defaultQuestion: QuizQuestion = {
    question: "What most improves the quality of this book summary?",
    options: ["Richer description", "More extractable text", "Author context", "All of the above"],
    correct: 3,
    explanation: "More grounded source text materially improves factual quality.",
  }

  return {
    summary,
    detailedSummary: undefined,
    keyPoints: [
      "Current data is insufficient for fine-grained conclusions",
      "Provide richer book text and regenerate",
      "Potentially misleading concrete claims were intentionally avoided",
    ],
    keywords: tags.length ? tags : ["insufficient-data", "needs-more-text"],
    topics: tags.slice(0, 6),
    readingTime,
    difficulty: "Intermediate",
    authorBackground: undefined,
    bookBackground: undefined,
    worldRelevance: undefined,
    quizQuestions: [defaultQuestion],
    mindmapData: {
      name: bookContent.title || "Untitled Book",
      children: [
        {
          name: "Missing Inputs",
          children: [{ name: "Book Text" }, { name: "Chapter Structure" }, { name: "Theme Signals" }],
        },
      ],
    },
    confidence: 0.3,
  }
}

function normalizeParsedResult(
  parsed: ParsedAnalysis | null,
  bookContent: BookContent,
  readingTime: number
): AIBookAnalysis {
  if (!parsed) {
    return buildFallbackAnalysis(bookContent, readingTime, "invalid AI JSON")
  }

  const fallback = buildFallbackAnalysis(bookContent, readingTime)

  const summary = toTrimmedString(parsed.summary) || fallback.summary
  const detailedSummary = toTrimmedString(parsed.detailedSummary) || undefined
  const keyPoints = normalizeStringArray(parsed.keyPoints, 6)
  const keywords = normalizeStringArray(parsed.keywords, 12)
  const topics = normalizeStringArray(parsed.topics, 6)
  const authorBackground = toTrimmedString(parsed.authorBackground) || undefined
  const bookBackground = toTrimmedString(parsed.bookBackground) || undefined
  const worldRelevance = toTrimmedString(parsed.worldRelevance) || undefined
  const difficulty = normalizeDifficulty(toTrimmedString(parsed.difficulty))
  const confidence =
    typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
      ? Math.max(0, Math.min(1, parsed.confidence))
      : 0.65

  const quizQuestions = Array.isArray(parsed.quizQuestions)
    ? parsed.quizQuestions
        .filter(
          (q) =>
            q &&
            typeof q.question === "string" &&
            Array.isArray(q.options) &&
            q.options.length === 4 &&
            typeof q.correct === "number"
        )
        .slice(0, 5)
    : fallback.quizQuestions

  return {
    summary,
    detailedSummary,
    keyPoints: keyPoints.length ? keyPoints : fallback.keyPoints,
    keywords: keywords.length ? keywords : fallback.keywords,
    topics: topics.length ? topics : fallback.topics,
    readingTime,
    difficulty,
    authorBackground,
    bookBackground,
    worldRelevance,
    quizQuestions,
    mindmapData: parsed.mindmapStructure || fallback.mindmapData,
    confidence,
  }
}

export async function analyzeBookWithAI(bookContent: BookContent): Promise<AIBookAnalysis> {
  const estimatedWords = bookContent.pageCount ? bookContent.pageCount * 300 : 50000
  const readingTime = Math.max(1, Math.floor(estimatedWords / 200))

  try {
    const { client: openai, model } = await createConfiguredOpenAIClient({
      openaiModel: "gpt-4o-mini",
      minimaxModel: "MiniMax-Text-01",
      googleModel: "gemini-2.0-flash",
    })

    if (!openai) {
      return buildFallbackAnalysis(bookContent, readingTime, "AI provider key not configured")
    }

    const sourceText = extractBookText(bookContent)
    const prompt = buildPrompt(sourceText)

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a strict book-analysis assistant. Output must be grounded to provided content and JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
      max_tokens: 2500,
    })

    const raw = toTrimmedString(completion.choices?.[0]?.message?.content)
    const parsed = raw ? safeJsonParse<ParsedAnalysis>(raw) : null
    if (parsed) {
      return normalizeParsedResult(parsed, bookContent, readingTime)
    }

    const repair = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: "Convert the input into one valid JSON object only. No markdown.",
        },
        {
          role: "user",
          content: `Fix this into strict JSON preserving meaning:\n${raw || "EMPTY_RESPONSE"}`,
        },
      ],
      temperature: 0,
      max_tokens: 2000,
    })

    const repairedRaw = toTrimmedString(repair.choices?.[0]?.message?.content)
    const repairedParsed = repairedRaw ? safeJsonParse<ParsedAnalysis>(repairedRaw) : null
    return normalizeParsedResult(repairedParsed, bookContent, readingTime)
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown AI error"
    return buildFallbackAnalysis(bookContent, readingTime, message)
  }
}

export async function analyzeBookFromPDF(
  bookMetadata: BookContent,
  pdfTextContent?: string
): Promise<AIBookAnalysis> {
  return analyzeBookWithAI({
    ...bookMetadata,
    textContent: pdfTextContent,
  })
}

