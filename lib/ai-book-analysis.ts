import OpenAI from 'openai'

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface AIBookAnalysis {
  summary: string
  keyPoints: string[]
  keywords: string[]
  topics: string[]
  readingTime: number
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  mindmapData: any
  confidence: number // 0-1 score indicating analysis quality
}

export interface BookContent {
  title: string
  author?: string
  description?: string
  tags?: string
  textContent?: string // Extracted PDF text content
  pageCount?: number
}

/**
 * Extract text content from PDF using basic metadata
 * In production, you might want to use PDF parsing libraries
 */
async function extractBookText(bookContent: BookContent): Promise<string> {
  // For now, we'll use available metadata to create a content summary
  const parts = []
  
  if (bookContent.title) parts.push(`Title: ${bookContent.title}`)
  if (bookContent.author) parts.push(`Author: ${bookContent.author}`)
  if (bookContent.description) parts.push(`Description: ${bookContent.description}`)
  if (bookContent.tags) parts.push(`Topics: ${bookContent.tags}`)
  
  // If we have actual text content, use it
  if (bookContent.textContent) {
    parts.push(`Content: ${bookContent.textContent.slice(0, 5000)}`) // Limit for API
  }
  
  return parts.join('\n\n')
}

/**
 * Analyze a book using OpenAI GPT-4 to extract insights
 */
export async function analyzeBookWithAI(bookContent: BookContent): Promise<AIBookAnalysis> {
  // Estimate reading time (300 words per page, 200 words per minute) - outside try-catch
  const estimatedWords = bookContent.pageCount ? bookContent.pageCount * 300 : 50000
  const readingTimeMinutes = Math.floor(estimatedWords / 200)

  try {
    console.log('Starting AI analysis for book:', bookContent.title)
    
    // Extract available text content
    const textContent = await extractBookText(bookContent)
    
    // Detect the primary language of the book content
    const detectLanguage = (content: string): string => {
      // Check for Chinese characters (CJK Unified Ideographs)
      const chineseCharCount = (content.match(/[\u4e00-\u9fff]/g) || []).length
      const totalChars = content.length
      
      console.log(`Language detection: Chinese chars: ${chineseCharCount}, Total chars: ${totalChars}`)
      console.log(`Book content sample: ${content.substring(0, 200)}`)
      
      // If more than 5% of characters are Chinese, or title contains Chinese, consider it a Chinese book
      if ((totalChars > 0 && (chineseCharCount / totalChars) > 0.05) || 
          bookContent.title.match(/[\u4e00-\u9fff]/)) {
        console.log('Detected as Chinese book')
        return 'Chinese'
      }
      
      console.log('Detected as English book')
      // Default to English
      return 'English'
    }

    const bookLanguage = detectLanguage(textContent)
    const isChineseBook = bookLanguage === 'Chinese'
    console.log(`Book language detected: ${bookLanguage}, Using Chinese analysis: ${isChineseBook}`)

    // Create language-appropriate prompt for book analysis
    const analysisPrompt = isChineseBook ? `
请分析以下书籍并提供全面的中文分析，返回JSON格式：

${textContent}

请按以下JSON结构提供分析（所有内容必须用中文）：
{
  "summary": "书籍主要内容和价值主张的全面2-3句总结",
  "keyPoints": ["从这本书中得出的6个具体、可行的关键见解或要点"],
  "keywords": ["这本书的12个重要关键词和概念"],
  "topics": ["这本书涵盖的6个主要主题领域"],
  "difficulty": "初级|中级|高级",
  "mindmapStructure": {
    "name": "书名",
    "children": [
      {
        "name": "主要类别1",
        "children": [
          {"name": "子概念1", "children": [{"name": "详细内容1"}, {"name": "详细内容2"}]},
          {"name": "子概念2", "children": [{"name": "详细内容3"}, {"name": "详细内容4"}]}
        ]
      }
    ]
  },
  "confidence": 0.85
}

要求：
- 确保总结引人入胜且信息丰富
- 确保关键点具体且可行
- 包含与书籍领域相关的关键词
- 创建具有3-4个主要分支的逻辑思维导图层次结构
- 根据内容复杂性分配适当的难度级别
- 基于可用信息质量提供置信度分数（0-1）
- 所有内容都必须用中文回答

只返回有效的JSON，不要任何markdown格式或额外文本。` : `
Analyze the following book and provide a comprehensive analysis in JSON format:

${textContent}

Please provide analysis in the following JSON structure:
{
  "summary": "A comprehensive 2-3 sentence summary of the book's main content and value proposition",
  "keyPoints": ["6 specific, actionable key insights or takeaways from this book"],
  "keywords": ["12 important keywords and concepts from this book"],
  "topics": ["6 main topic areas covered in this book"],
  "difficulty": "Beginner|Intermediate|Advanced",
  "mindmapStructure": {
    "name": "Book Title",
    "children": [
      {
        "name": "Main Category 1",
        "children": [
          {"name": "Subconcept 1", "children": [{"name": "Detail 1"}, {"name": "Detail 2"}]},
          {"name": "Subconcept 2", "children": [{"name": "Detail 3"}, {"name": "Detail 4"}]}
        ]
      }
    ]
  },
  "confidence": 0.85
}

Requirements:
- Make the summary engaging and informative
- Ensure key points are specific and actionable  
- Include relevant keywords for the book's domain
- Create a logical mindmap hierarchy with 3-4 main branches
- Assign appropriate difficulty level based on content complexity
- Provide confidence score (0-1) based on available information quality
- All content should be in English

Return only valid JSON without any markdown formatting or additional text.`

    // Call OpenAI API with language-specific system message
    const systemMessage = isChineseBook 
      ? "你是一位专业的图书分析专家和知识提取专家。你专门分析书籍并创建结构化的见解、摘要和思维导图。始终返回有效的JSON格式，不要使用markdown格式。所有分析内容必须用中文回答。"
      : "You are an expert book analyst and knowledge extraction specialist. You analyze books and create structured insights, summaries, and mind maps. Always return valid JSON without any markdown formatting."

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        {
          role: "system", 
          content: systemMessage
        },
        {
          role: "user",
          content: analysisPrompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent analysis
    })

    const response = completion.choices[0]?.message?.content
    if (!response) {
      throw new Error('No response from OpenAI API')
    }

    console.log('Raw OpenAI response:', response)

    // Parse the JSON response
    let analysisResult
    try {
      // Clean the response to ensure it's valid JSON
      const cleanedResponse = response
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      analysisResult = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Failed to parse OpenAI response as JSON:', parseError)
      console.error('Response was:', response)
      throw new Error('Invalid JSON response from OpenAI')
    }

    // Validate and structure the response
    const aiAnalysis: AIBookAnalysis = {
      summary: analysisResult.summary || `${bookContent.title} by ${bookContent.author || 'Unknown Author'} offers valuable insights and knowledge in its field.`,
      keyPoints: Array.isArray(analysisResult.keyPoints) ? analysisResult.keyPoints.slice(0, 6) : [
        "Comprehensive exploration of core concepts",
        "Practical applications and real-world examples", 
        "Evidence-based insights and methodologies",
        "Contemporary relevance and future implications",
        "Integration of multiple perspectives",
        "Actionable frameworks and strategies"
      ],
      keywords: Array.isArray(analysisResult.keywords) ? analysisResult.keywords.slice(0, 12) : [
        "methodology", "framework", "analysis", "principles", "implementation", "strategy"
      ],
      topics: Array.isArray(analysisResult.topics) ? analysisResult.topics.slice(0, 6) : [
        "Core Concepts", "Practical Applications", "Case Studies", "Methodologies"
      ],
      readingTime: readingTimeMinutes,
      difficulty: ["Beginner", "Intermediate", "Advanced", "初级", "中级", "高级"].includes(analysisResult.difficulty) 
        ? (analysisResult.difficulty === "初级" ? "Beginner" : 
           analysisResult.difficulty === "中级" ? "Intermediate" :
           analysisResult.difficulty === "高级" ? "Advanced" : analysisResult.difficulty)
        : "Intermediate",
      mindmapData: analysisResult.mindmapStructure || {
        name: bookContent.title,
        children: [
          {
            name: "Key Concepts",
            children: [
              { name: "Foundational Principles", children: [{ name: "Core Theory" }, { name: "Applications" }] },
              { name: "Methodologies", children: [{ name: "Approaches" }, { name: "Techniques" }] }
            ]
          }
        ]
      },
      confidence: typeof analysisResult.confidence === 'number' 
        ? Math.max(0, Math.min(1, analysisResult.confidence))
        : 0.7
    }

    console.log('Successfully analyzed book with AI:', bookContent.title)
    return aiAnalysis

  } catch (error) {
    console.error('Error in AI book analysis:', error)
    
    // Return fallback analysis if AI fails
    return generateFallbackAnalysis(bookContent, readingTimeMinutes)
  }
}

/**
 * Generate a fallback analysis if AI service fails
 */
function generateFallbackAnalysis(bookContent: BookContent, readingTimeMinutes: number): AIBookAnalysis {
  console.log('Using fallback analysis for:', bookContent.title)
  
  const tags = bookContent.tags ? bookContent.tags.split(',').map(tag => tag.trim()) : []
  
  // Detect if this is a Chinese book
  const bookText = `${bookContent.title} ${bookContent.author || ''} ${bookContent.description || ''}`.toLowerCase()
  const chineseCharCount = (bookText.match(/[\u4e00-\u9fff]/g) || []).length
  const isChineseBook = chineseCharCount > 0 || bookText.includes('chinese') || bookText.includes('中文')
  
  if (isChineseBook) {
    return {
      summary: `《${bookContent.title}》由${bookContent.author || '未知作者'}撰写，是该领域的重要作品。本书结合理论基础与实践见解，为读者提供宝贵的知识和可操作的指导。`,
      keyPoints: [
        "全面探讨基本概念和核心原理",
        "结合实际应用和现实案例研究",
        "基于证据的方法论和经过验证的框架", 
        "对当前趋势和发展的当代视角",
        "整合多种观点和跨学科见解",
        "实施和未来发展的可行策略"
      ],
      keywords: [
        ...tags.slice(0, 6),
        "方法论", "框架", "分析", "原理", "实施", "策略"
      ].slice(0, 12),
      topics: [
        "基础概念",
        "实际应用",
        "案例研究与范例", 
        "方法论与框架",
        "当前趋势与未来方向",
        "实施策略"
      ],
      readingTime: readingTimeMinutes,
      difficulty: "Intermediate" as const,
      mindmapData: {
        name: bookContent.title,
        children: [
          {
            name: "核心概念",
            children: [
              { 
                name: "基本原理", 
                children: [
                  { name: "理论基础" },
                  { name: "关键假设" },
                  { name: "历史背景" }
                ]
              },
              { 
                name: "核心要素", 
                children: [
                  { name: "关键组成部分" },
                  { name: "相互关系" },
                  { name: "依赖性" }
                ]
              }
            ]
          },
          {
            name: "实际应用",
            children: [
              { 
                name: "现实案例", 
                children: [
                  { name: "案例研究分析" },
                  { name: "行业应用" },
                  { name: "成功案例" }
                ]
              },
              { 
                name: "实施方法", 
                children: [
                  { name: "分步流程" },
                  { name: "最佳实践" },
                  { name: "常见陷阱" }
                ]
              }
            ]
          },
          {
            name: "未来展望",
            children: [
              { 
                name: "新兴趋势", 
                children: [
                  { name: "技术影响" },
                  { name: "市场演变" },
                  { name: "社会变化" }
                ]
              },
              { 
                name: "战略考虑", 
                children: [
                  { name: "长期规划" },
                  { name: "风险评估" },
                  { name: "机会识别" }
                ]
              }
            ]
          }
        ]
      },
      confidence: 0.6
    }
  }
  
  return {
    summary: `${bookContent.title} by ${bookContent.author || 'Unknown Author'} provides comprehensive coverage of its subject matter. This work combines theoretical foundations with practical insights, offering readers valuable knowledge and actionable guidance in the field.`,
    keyPoints: [
      "Comprehensive exploration of fundamental concepts and principles",
      "Practical applications with real-world examples and case studies",
      "Evidence-based methodologies and proven frameworks", 
      "Contemporary perspectives on current trends and developments",
      "Integration of multiple viewpoints and interdisciplinary insights",
      "Actionable strategies for implementation and future growth"
    ],
    keywords: [
      ...tags.slice(0, 6),
      "methodology", "framework", "analysis", "principles", "implementation", "strategy"
    ].slice(0, 12),
    topics: [
      "Foundational Concepts",
      "Practical Applications",
      "Case Studies & Examples", 
      "Methodologies & Frameworks",
      "Current Trends & Future Directions",
      "Implementation Strategies"
    ],
    readingTime: readingTimeMinutes,
    difficulty: "Intermediate" as const,
    mindmapData: {
      name: bookContent.title,
      children: [
        {
          name: "Core Concepts",
          children: [
            { 
              name: "Fundamental Principles", 
              children: [
                { name: "Theoretical Foundation" },
                { name: "Key Assumptions" },
                { name: "Historical Context" }
              ]
            },
            { 
              name: "Essential Elements", 
              children: [
                { name: "Critical Components" },
                { name: "Interconnections" },
                { name: "Dependencies" }
              ]
            }
          ]
        },
        {
          name: "Practical Applications",
          children: [
            { 
              name: "Real-world Examples", 
              children: [
                { name: "Case Study Analysis" },
                { name: "Industry Applications" },
                { name: "Success Stories" }
              ]
            },
            { 
              name: "Implementation Methods", 
              children: [
                { name: "Step-by-step Processes" },
                { name: "Best Practices" },
                { name: "Common Pitfalls" }
              ]
            }
          ]
        },
        {
          name: "Future Implications",
          children: [
            { 
              name: "Emerging Trends", 
              children: [
                { name: "Technology Impact" },
                { name: "Market Evolution" },
                { name: "Social Changes" }
              ]
            },
            { 
              name: "Strategic Considerations", 
              children: [
                { name: "Long-term Planning" },
                { name: "Risk Assessment" },
                { name: "Opportunity Identification" }
              ]
            }
          ]
        }
      ]
    },
    confidence: 0.6 // Lower confidence for fallback
  }
}

/**
 * Enhanced analysis that includes PDF text extraction
 * This would be used when you have access to actual PDF content
 */
export async function analyzeBookFromPDF(
  bookMetadata: BookContent, 
  pdfTextContent?: string
): Promise<AIBookAnalysis> {
  const enhancedContent = {
    ...bookMetadata,
    textContent: pdfTextContent
  }
  
  return analyzeBookWithAI(enhancedContent)
}
