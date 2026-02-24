import { NextRequest, NextResponse } from "next/server"
import { createConfiguredOpenAIClient } from "@/lib/server/openai-config"

// Set maximum execution time (Vercel Pro supports up to 60 seconds)
export const maxDuration = 60
export const dynamic = "force-dynamic"

function extractLikelyPdfText(pdfBytes: Uint8Array): string {
  const raw = new TextDecoder("latin1").decode(pdfBytes)

  // Prefer explicit PDF text operators: (...) Tj and [...] TJ.
  const directTextMatches = Array.from(raw.matchAll(/\(([^()\\]|\\.){2,500}\)\s*Tj/g))
    .map((match) => match[0])
    .join(" ")

  const arrayTextMatches = Array.from(raw.matchAll(/\[([\s\S]*?)\]\s*TJ/g))
    .map((match) => match[1])
    .join(" ")

  const inlineLiterals = `${directTextMatches} ${arrayTextMatches}`
    .replace(/[()[\]]/g, " ")
    .replace(/\\[nrtbf()\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (inlineLiterals.length > 200) {
    return inlineLiterals
  }

  // Fallback for PDFs where text is encoded differently.
  return raw
    .replace(/[^\x20-\x7E\u00A0-\u00FF\u4E00-\u9FFF\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function POST(request: NextRequest) {
  try {
    const { client: openai, model } = await createConfiguredOpenAIClient({
      openaiModel: "gpt-4o-mini",
      minimaxModel: "MiniMax-M2.5",
    })

    if (!openai) {
      return NextResponse.json(
        { error: "AI provider key is not configured. Set provider key in env vars or Admin Settings." },
        { status: 503 }
      )
    }

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const textSample = extractLikelyPdfText(uint8Array).slice(0, 4000)

    if (!textSample) {
      return NextResponse.json(
        { error: "Could not extract readable text from this PDF. Please fill metadata manually." },
        { status: 422 }
      )
    }

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      max_tokens: 1000,
      messages: [
        {
          role: "system",
          content: `You are a book metadata extraction expert. Analyze the provided text from the first few pages of a book and extract the following information:
- Title (the main book title)
- Author (the author's name)
- Publisher (the publishing company)
- Publication Year (just the year as a number)
- ISBN (if available)
- Short Description (a 2-3 sentence summary based on the content)

IMPORTANT: Write the description in the SAME LANGUAGE as the book content. If the book is in Chinese, write the description in Chinese. If the book is in English, write the description in English.

Return the information as a JSON object with these exact keys: title, author, publisher, year, isbn, description.
If you cannot find a field, use an empty string for text fields or null for year.
Be concise and accurate. For the description, write a professional book description based on the content you see, in the same language as the book.`,
        },
        {
          role: "user",
          content: `Extract metadata from this book:\n\n${textSample}`,
        },
      ],
    })

    const responseText = completion.choices[0]?.message?.content || "{}"

    let metadata
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0])
      } else {
        metadata = JSON.parse(responseText)
      }
    } catch (error) {
      console.error("Failed to parse AI response:", error)
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
    }

    const cleanedMetadata = {
      title: metadata.title || "",
      author: metadata.author || "",
      publisher: metadata.publisher || "",
      year: metadata.year ? parseInt(metadata.year.toString(), 10) : null,
      isbn: metadata.isbn || "",
      description: metadata.description || "",
      coverImageUrl: null,
    }

    return NextResponse.json(cleanedMetadata)
  } catch (error) {
    console.error("Error in AI autofill:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract metadata" },
      { status: 500 }
    )
  }
}
