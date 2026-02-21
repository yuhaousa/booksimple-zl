import { NextRequest, NextResponse } from "next/server"
import * as pdfjsLib from "pdfjs-dist"
import { createConfiguredOpenAIClient } from "@/lib/server/openai-config"

// Set maximum execution time (Vercel Pro supports up to 60 seconds)
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const { client: openai, model } = await createConfiguredOpenAIClient({
      openaiModel: "gpt-4o-mini",
      minimaxModel: "MiniMax-Text-01",
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

    // Convert file to Uint8Array for PDF.js
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)

    // Extract text from PDF
    console.log("📄 Extracting text from PDF...")
    const loadingTask = pdfjsLib.getDocument({ data: uint8Array })
    const pdfDocument = await loadingTask.promise

    // Note: Cover image generation from PDF is skipped for now
    // as it requires complex canvas setup on server-side
    let coverImageUrl = null

    // Extract text from first 5 pages for metadata
    let extractedText = ""
    const maxPages = Math.min(5, pdfDocument.numPages)

    for (let i = 1; i <= maxPages; i++) {
      const page = await pdfDocument.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items.map((item: any) => item.str).join(" ")
      extractedText += pageText + "\n"
    }

    // Limit text to first 4000 characters to save tokens
    const textSample = extractedText.slice(0, 4000)

    console.log("🤖 Asking AI to extract metadata...")
    
    // Use AI to extract metadata
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
    console.log("🤖 AI Response:", responseText)

    // Parse the JSON response
    let metadata
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        metadata = JSON.parse(jsonMatch[0])
      } else {
        metadata = JSON.parse(responseText)
      }
    } catch (e) {
      console.error("Failed to parse AI response:", e)
      return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 })
    }

    // Clean up and validate the metadata
    const cleanedMetadata = {
      title: metadata.title || "",
      author: metadata.author || "",
      publisher: metadata.publisher || "",
      year: metadata.year ? parseInt(metadata.year.toString()) : null,
      isbn: metadata.isbn || "",
      description: metadata.description || "",
      coverImageUrl: coverImageUrl || null,
    }

    console.log("✅ Extracted metadata:", cleanedMetadata)

    return NextResponse.json(cleanedMetadata)
  } catch (error) {
    console.error("Error in AI autofill:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to extract metadata" },
      { status: 500 }
    )
  }
}
