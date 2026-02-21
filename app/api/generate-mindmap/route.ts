import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return null
  }
  return new OpenAI({ apiKey })
}

function getSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    return null
  }
  return createClient(supabaseUrl, serviceRoleKey)
}

export async function POST(request: NextRequest) {
  try {
    const openai = getOpenAIClient()
    if (!openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY is not configured' },
        { status: 503 }
      )
    }

    const supabase = getSupabaseAdminClient()
    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase server credentials are not configured' },
        { status: 503 }
      )
    }

    const body = await request.json()
    console.log('Generate mindmap request:', body)
    
    const { bookId, userId, forceRegenerate } = body

    if (!bookId || !userId) {
      console.error('Missing parameters:', { bookId, userId })
      return NextResponse.json(
        { error: 'Missing bookId or userId' },
        { status: 400 }
      )
    }

    // Check if analysis already exists (unless force regenerate)
    if (!forceRegenerate) {
      const { data: existingAnalysis } = await supabase
        .from('ai_book_analysis')
        .select('*')
        .eq('book_id', bookId)
        .single()

      if (existingAnalysis && existingAnalysis.mind_map_data) {
        return NextResponse.json({
          success: true,
          cached: true,
          data: {
            summary: existingAnalysis.summary,
            mindMapData: existingAnalysis.mind_map_data
          }
        })
      }
    }

    // Get book information
    const { data: book, error: bookError } = await supabase
      .from('Booklist')
      .select('*')
      .eq('id', bookId)
      .single()

    if (bookError || !book) {
      console.error('Book not found:', bookError)
      return NextResponse.json(
        { error: 'Book not found: ' + (bookError?.message || 'Unknown error') },
        { status: 404 }
      )
    }
    
    console.log('Found book:', book.title)

    // Generate AI analysis for mind map
    const prompt = `请为《${book.title}》${book.author ? `（作者：${book.author}）` : ''}这本书生成一个详细的思维导图结构。

要求：
1. 创建3-5个主要章节/主题
2. 每个主题包含2-4个小节
3. 每个小节包含2-3个关键要点
4. 提取5-8个核心概念
5. 总结3-5个主要主题

请以JSON格式返回，结构如下：
{
  "chapters": [
    {
      "title": "章节标题",
      "sections": ["小节1", "小节2", "小节3"],
      "key_points": ["要点1", "要点2", "要点3"]
    }
  ],
  "key_concepts": ["概念1", "概念2", ...],
  "main_themes": ["主题1", "主题2", ...]
}

${book.description ? `书籍简介：${book.description}` : ''}

请确保内容专业、准确、有深度。`

    console.log('Calling OpenAI for mind map generation...')
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的图书分析专家，擅长提炼书籍的核心内容并创建结构化的思维导图。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' }
    })

    const aiResponse = completion.choices[0].message.content
    if (!aiResponse) {
      throw new Error('No response from AI')
    }

    console.log('OpenAI response received, parsing...')
    const mindMapData = JSON.parse(aiResponse)
    console.log('Mind map data structure:', Object.keys(mindMapData))

    // Generate summary
    const summaryPrompt = `请为《${book.title}》写一段200字左右的导读，概括这本书的核心价值和阅读要点。`

    const summaryCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的图书评论家，擅长撰写精炼的图书导读。'
        },
        {
          role: 'user',
          content: summaryPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 500
    })

    const summary = summaryCompletion.choices[0].message.content || `《${book.title}》是一本值得深入阅读的著作。`
    console.log('Summary generated, length:', summary.length)

    // Save to database - first check if record exists
    console.log('Checking for existing record...')
    const { data: existingRecord } = await supabase
      .from('ai_book_analysis')
      .select('id')
      .eq('book_id', bookId)
      .maybeSingle()

    let savedData

    if (existingRecord) {
      // Update existing record
      console.log('Updating existing record:', existingRecord.id)
      const { data: updateData, error: updateError } = await supabase
        .from('ai_book_analysis')
        .update({
          summary: summary,
          content_analysis: mindMapData,
          mind_map_data: mindMapData,
          updated_at: new Date().toISOString(),
          ai_model_used: 'gpt-4o-mini',
          analysis_version: '1.0',
          last_accessed_at: new Date().toISOString()
        })
        .eq('book_id', bookId)
        .select()
        .single()

      if (updateError) {
        throw updateError
      }
      savedData = updateData
      console.log('Record updated successfully')
    } else {
      // Insert new record
      console.log('Inserting new record...')
      const { data: insertData, error: insertError } = await supabase
        .from('ai_book_analysis')
        .insert({
          book_id: bookId,
          user_id: userId,
          summary: summary,
          content_analysis: mindMapData,
          mind_map_data: mindMapData,
          content_hash: 'ai_generated_' + Date.now(),
          ai_model_used: 'gpt-4o-mini',
          analysis_version: '1.0'
        })
        .select()
        .single()

      if (insertError) {
        console.error('Insert error:', insertError)
        throw insertError
      }
      savedData = insertData
      console.log('Record inserted successfully')
    }

    console.log('Returning success response')
    return NextResponse.json({
      success: true,
      cached: false,
      data: {
        summary,
        mindMapData
      }
    })

  } catch (error: any) {
    console.error('Error generating mind map:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to generate mind map' },
      { status: 500 }
    )
  }
}
