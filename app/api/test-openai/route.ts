import { NextResponse } from 'next/server'
import { createConfiguredOpenAIClient, getConfiguredOpenAIKey } from '@/lib/server/openai-config'

export async function GET() {
  try {
    const configured = await getConfiguredOpenAIKey()
    if (!configured.apiKey || configured.apiKey === 'your_openai_api_key_here') {
      return NextResponse.json({
        success: false,
        error: 'AI provider key not configured or is placeholder',
        source: configured.source,
        provider: configured.provider,
      }, { status: 400 })
    }

    // Test the API key with a simple request
    const { client: openai, model, provider } = await createConfiguredOpenAIClient({
      openaiModel: "gpt-4o-mini",
      minimaxModel: "MiniMax-M2.5",
    })
    if (!openai) {
      return NextResponse.json({
        success: false,
        error: 'AI provider key is unavailable at runtime',
      }, { status: 400 })
    }

    const response = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'user', content: 'Say "API key is working!" in one sentence.' }
      ],
      max_tokens: 20,
    })

    return NextResponse.json({
      success: true,
      message: 'AI provider key is valid and working!',
      testResponse: response.choices[0].message.content,
      model: response.model,
      source: configured.source,
      provider,
    })
  } catch (error: any) {
    console.error('AI API test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.error || null,
      type: error.type || null,
    }, { status: 500 })
  }
}
