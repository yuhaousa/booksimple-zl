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
  authorBackground?: string
  bookBackground?: string
  worldRelevance?: string
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
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.warn('No OpenAI API key configured, using fallback analysis')
      throw new Error('OpenAI API key not configured')
    }
    
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
  "summary": "书籍主要内容、关键主题和价值主张的详细且引人入胜的总结（300-500字）",
  "keyPoints": ["从这本书中得出的6个具体、可行的关键见解或要点"],
  "keywords": ["这本书的12个重要关键词和概念"],
  "topics": ["这本书涵盖的6个主要主题领域"],
  "difficulty": "初级|中级|高级",
  "authorBackground": "作者的详细背景介绍，包括教育背景、职业经历、主要成就、写作动机等（200-300字）",
  "bookBackground": "本书的创作背景，包括写作时的历史背景、社会环境、创作过程、出版影响等（200-300字）",
  "worldRelevance": "这本书对当今世界的意义和影响，包括在现代社会的应用价值、对当前问题的启示等（200-300字）",
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
- 确保总结详细、引人入胜且全面（300-500字）
- 包括书籍的主要主题、核心概念和实用价值
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
  "summary": "A detailed and engaging summary of the book's main content, key themes, and value proposition (300-500 words)",
  "keyPoints": ["6 specific, actionable key insights or takeaways from this book"],
  "keywords": ["12 important keywords and concepts from this book"],
  "topics": ["6 main topic areas covered in this book"],
  "difficulty": "Beginner|Intermediate|Advanced",
  "authorBackground": "Detailed background about the author including education, career, achievements, and motivation for writing (200-300 words)",
  "bookBackground": "Background about the book's creation including historical context, social environment, writing process, and publishing impact (200-300 words)",
  "worldRelevance": "The book's significance and impact on today's world, including practical applications in modern society and insights for current issues (200-300 words)",
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
- Make the summary detailed, engaging, and comprehensive (300-500 words)
- Include the book's main themes, key concepts, and practical value
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
      summary: analysisResult.summary || `${bookContent.title} by ${bookContent.author || 'Unknown Author'} is a comprehensive work that explores its subject matter through multiple dimensions and perspectives. This book combines theoretical foundations with practical applications, offering readers a deep understanding of the core concepts and their real-world implications. 

The author presents well-researched insights backed by evidence and expert analysis, making complex topics accessible to both newcomers and experienced practitioners in the field. Through careful examination of key themes and methodologies, the work provides valuable frameworks and strategies that readers can apply to their own contexts and challenges.

What sets this book apart is its balanced approach to presenting different viewpoints while maintaining scholarly rigor. The content is structured to build understanding progressively, with each chapter building upon previous concepts to create a comprehensive learning experience. Whether you're seeking foundational knowledge or advanced insights, this work offers practical value and intellectual enrichment that extends beyond its immediate subject matter.`,
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
      authorBackground: analysisResult.authorBackground || undefined,
      bookBackground: analysisResult.bookBackground || undefined,
      worldRelevance: analysisResult.worldRelevance || undefined,
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
      summary: `《${bookContent.title}》由${bookContent.author || '未知作者'}撰写，是该领域内一部具有重要价值的综合性著作。本书通过多维度和多角度的深入探讨，为读者提供了对核心概念及其实际应用的全面理解。

作者在书中巧妙地将理论基础与实践应用相结合，通过大量的实证研究和专家分析，使复杂的主题变得易于理解和掌握。无论是初学者还是该领域的资深从业者，都能从中获得有价值的见解和可操作的指导。

这本书的独特之处在于其平衡的写作方法，既保持了学术严谨性，又兼顾了实用性和可读性。内容结构清晰，层次分明，每个章节都在前一章的基础上递进发展，为读者构建了完整的知识体系。不论您是在寻求基础知识还是高级见解，这部作品都能提供实用价值和智力启发，其影响力远超其直接涉及的主题范围。`,
      authorBackground: `${bookContent.author || '本书作者'}在相关领域具有深厚的学术背景和丰富的实践经验。凭借多年的研究和探索，作者积累了丰富的专业知识和独到的见解。作者的教育背景和职业经历为其创作这部作品提供了坚实的理论基础和实践支撑，使得本书能够结合理论深度与实用价值。`,
      bookBackground: `本书的创作背景反映了当代社会对相关主题日益增长的关注和需求。在快速变化的时代背景下，作者敏锐地捕捉到了读者对系统性知识和实用指导的渴望，因此决定将其多年的研究成果和实践经验整理成书，为读者提供一个全面而深入的学习资源。`,
      worldRelevance: `在当今快速发展的世界中，本书所探讨的主题具有重要的现实意义和应用价值。随着科技进步和社会变革，书中提出的理念和方法论在解决当前面临的挑战方面展现出巨大的潜力。本书不仅为读者提供了理解复杂问题的框架，更为应对未来挑战提供了有价值的思路和工具。`,
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
    summary: `${bookContent.title} by ${bookContent.author || 'Unknown Author'} stands as a comprehensive and authoritative exploration of its subject domain, offering readers an in-depth journey through both foundational principles and cutting-edge developments. This scholarly work masterfully weaves together theoretical frameworks with practical applications, creating a balanced resource that serves multiple audiences and learning objectives.

The author demonstrates exceptional expertise in presenting complex concepts through accessible language and well-structured arguments, supported by extensive research and real-world case studies. Each chapter builds systematically upon previous knowledge, creating a cohesive learning experience that guides readers from basic understanding to advanced proficiency in the field.

What distinguishes this work is its commitment to practical relevance alongside academic rigor. The book includes actionable frameworks, proven methodologies, and strategic insights that readers can immediately apply to their professional and personal contexts. Through its comprehensive approach to the subject matter, this publication serves as both an educational resource and a practical reference guide, making it invaluable for students, practitioners, and researchers alike who seek to deepen their understanding and enhance their capabilities in this important field.`,
    authorBackground: `${bookContent.author || 'The author'} brings extensive academic credentials and practical experience to this work, having spent years researching and working in the relevant field. Their educational background and professional journey have equipped them with both theoretical depth and real-world insights that inform every aspect of this publication. The author's commitment to bridging theory and practice is evident throughout the work.`,
    bookBackground: `This book was conceived and written in response to growing recognition of the need for comprehensive, accessible resources in this field. The author identified a gap between academic research and practical application, leading to the development of this work that serves as both scholarly reference and practical guide. The writing process involved extensive research, consultation with experts, and careful consideration of reader needs.`,
    worldRelevance: `In today's rapidly evolving world, the topics addressed in this book have become increasingly relevant and important. The frameworks and insights presented offer valuable tools for understanding and navigating contemporary challenges. As technology advances and social structures continue to evolve, the principles and methodologies explored in this work provide timeless value while remaining adaptable to emerging circumstances and future developments.`,
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
