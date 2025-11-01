import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
  try {
    const apiKey = process.env.OPENAI_API_KEY
    
    if (!apiKey || apiKey === 'your_openai_api_key_here') {
      return NextResponse.json({
        success: false,
        error: 'OpenAI API key not configured or is placeholder',
        apiKey: apiKey ? 'Key exists but may be invalid' : 'No key found'
      }, { status: 400 })
    }

    // Test the API key with a simple request
    const openai = new OpenAI({
      apiKey: apiKey,
    })

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'user', content: 'Say "API key is working!" in one sentence.' }
      ],
      max_tokens: 20,
    })

    return NextResponse.json({
      success: true,
      message: 'OpenAI API key is valid and working!',
      testResponse: response.choices[0].message.content,
      model: response.model,
    })
  } catch (error: any) {
    console.error('OpenAI API test error:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      details: error.error || null,
      type: error.type || null,
    }, { status: 500 })
  }
}
