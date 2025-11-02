import { NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Extract text from PDF
    console.log("📄 Extracting text from PDF...")
    const loadingTask = getDocument({ data: buffer })
    const pdfDocument = await loadingTask.promise

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
      model: "gpt-4-turbo-preview",
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

Return the information as a JSON object with these exact keys: title, author, publisher, year, isbn, description.
If you cannot find a field, use an empty string for text fields or null for year.
Be concise and accurate. For the description, write a professional book description based on the content you see.`,
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
