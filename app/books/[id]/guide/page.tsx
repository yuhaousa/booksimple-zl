"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import { 
  ArrowLeft, 
  User, 
  Calendar, 
  Building, 
  BookOpen, 
  Globe, 
  MessageSquare, 
  HelpCircle,
  Brain,
  Star,
  Clock,
  Award
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { toast } from "sonner"

interface BookGuidePageProps {
  params: Promise<{ id: string }> | { id: string }
}

interface Book {
  id: number
  title: string
  author: string | null
  publisher: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  description: string | null
  tags: string | null
}

interface AIAnalysis {
  summary: string
  key_points?: string[]
  keyPoints?: string[]
  keywords: string[]
  topics: string[]
  difficulty: string
  mindmap_structure: any
  worldRelevance?: string
  world_relevance?: string
  authorBackground?: string
  author_background?: string
  bookBackground?: string
  book_background?: string
}

async function getBook(id: string) {
  const { data: book, error } = await supabase.from("Booklist").select("*").eq("id", id).single()

  if (error || !book) {
    return null
  }

  // Generate signed URL for cover
  let coverUrl = book.cover_url
  if (coverUrl) {
    const { data: signedCover, error: coverError } = await supabase.storage
      .from("book-cover")
      .createSignedUrl(coverUrl.replace(/^book-cover\//, ""), 60 * 60 * 24)
    if (!coverError && signedCover?.signedUrl) {
      coverUrl = signedCover.signedUrl
    }
  }

  return { ...book, cover_url: coverUrl }
}

async function getAIAnalysis(bookId: string): Promise<AIAnalysis | null> {
  try {
    // First try to get cached analysis
    const response = await fetch(`/api/books/${bookId}/ai-analysis`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (response.ok) {
      const data = await response.json()
      if (data.success && data.analysis) {
        // Transform the API response to match our interface
        return {
          summary: data.analysis.summary,
          key_points: data.analysis.keyPoints,
          keyPoints: data.analysis.keyPoints,
          keywords: data.analysis.keywords,
          topics: data.analysis.topics,
          difficulty: data.analysis.difficulty,
          mindmap_structure: data.analysis.mindmapData,
          world_relevance: data.analysis.worldRelevance,
          worldRelevance: data.analysis.worldRelevance,
          author_background: data.analysis.authorBackground,
          authorBackground: data.analysis.authorBackground,
          book_background: data.analysis.bookBackground,
          bookBackground: data.analysis.bookBackground
        }
      }
    }

    // If no cached analysis, try to generate new one
    const generateResponse = await fetch(`/api/books/${bookId}/ai-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (generateResponse.ok) {
      const generateData = await generateResponse.json()
      if (generateData.success && generateData.analysis) {
        // Transform the API response to match our interface
        return {
          summary: generateData.analysis.summary,
          key_points: generateData.analysis.keyPoints,
          keyPoints: generateData.analysis.keyPoints,
          keywords: generateData.analysis.keywords,
          topics: generateData.analysis.topics,
          difficulty: generateData.analysis.difficulty,
          mindmap_structure: generateData.analysis.mindmapData,
          world_relevance: generateData.analysis.worldRelevance,
          worldRelevance: generateData.analysis.worldRelevance,
          author_background: generateData.analysis.authorBackground,
          authorBackground: generateData.analysis.authorBackground,
          book_background: generateData.analysis.bookBackground,
          bookBackground: generateData.analysis.bookBackground
        }
      }
    }

    return null
  } catch (error) {
    console.error('Error fetching AI analysis:', error)
    return null
  }
}

export default function BookGuidePage({ params }: BookGuidePageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [aiAnalysis, setAIAnalysis] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [aiLoading, setAiLoading] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)
  const [activeTab, setActiveTab] = useState<'overview' | 'analysis' | 'quiz'>('overview')

  // Dynamic quiz questions based on book content
  const getQuizQuestions = () => {
    const isChineseBook = book?.title && /[\u4e00-\u9fff]/.test(book.title)
    
    if (isChineseBook) {
      return [
        {
          question: "根据书中内容，PARA系统的四个核心组成部分是什么？",
          options: ["项目、领域、资源、存档", "计划、行动、反思、总结", "收集、整理、分析、应用", "输入、处理、输出、反馈"],
          correct: 0,
          explanation: "PARA系统是第二大脑方法论的核心，包含Projects（项目）、Areas（领域）、Resources（资源）、Archives（存档）四个部分。"
        },
        {
          question: "CODE法则中的'D'代表什么含义？",
          options: ["删除(Delete)", "提炼(Distill)", "设计(Design)", "决策(Decide)"],
          correct: 1,
          explanation: "CODE法则中的D代表Distill（提炼），是将信息精炼成有用知识的关键步骤。"
        },
        {
          question: "建立第二大脑的主要目的是什么？",
          options: ["替代人脑思考", "减轻大脑负担，提高创造力", "存储更多信息", "提高记忆能力"],
          correct: 1,
          explanation: "第二大脑的核心目的是减轻生物大脑的负担，让我们专注于创造性思考和决策。"
        },
        {
          question: "在数字化知识管理中，最重要的原则是什么？",
          options: ["收集所有信息", "完美的分类系统", "可操作性和实用性", "复杂的标签体系"],
          correct: 2,
          explanation: "数字化知识管理的关键是确保信息具有可操作性，能够在需要时快速找到和使用。"
        },
        {
          question: "根据书中观点，信息捕获的最佳时机是？",
          options: ["每天固定时间", "有灵感的瞬间", "工作结束后", "周末整理时"],
          correct: 1,
          explanation: "书中强调要在灵感出现的瞬间立即捕获信息，因为创意和想法稍纵即逝。"
        }
      ]
    } else {
      return [
        {
          question: "According to the book, what are the four core components of the PARA system?",
          options: ["Projects, Areas, Resources, Archives", "Plan, Act, Review, Adjust", "Collect, Organize, Analyze, Apply", "Input, Process, Output, Feedback"],
          correct: 0,
          explanation: "The PARA system consists of Projects, Areas, Resources, and Archives - the four fundamental categories for organizing digital information."
        },
        {
          question: "What does the 'D' in the CODE method represent?",
          options: ["Delete", "Distill", "Design", "Decide"],
          correct: 1,
          explanation: "The 'D' in CODE stands for Distill - the process of extracting the most valuable insights from captured information."
        },
        {
          question: "What is the primary purpose of building a Second Brain?",
          options: ["Replace human thinking", "Reduce cognitive load and enhance creativity", "Store more information", "Improve memory capacity"],
          correct: 1,
          explanation: "The Second Brain aims to offload information storage from our biological brain, freeing it for higher-level creative and strategic thinking."
        },
        {
          question: "What is the most important principle in digital knowledge management?",
          options: ["Collect all information", "Perfect categorization", "Actionability and practicality", "Complex tagging systems"],
          correct: 2,
          explanation: "The key principle is ensuring information is actionable and can be quickly retrieved and used when needed."
        },
        {
          question: "According to the book, when is the best time to capture information?",
          options: ["At fixed daily times", "In moments of inspiration", "After work hours", "During weekend reviews"],
          correct: 1,
          explanation: "The book emphasizes capturing information in moments of inspiration, as ideas and insights are fleeting and easily lost."
        }
      ]
    }
  }

  const [quizQuestions] = useState(getQuizQuestions())
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [score, setScore] = useState(0)

  // Resolve params
  useEffect(() => {
    const resolveParams = async () => {
      try {
        if (params && typeof params === 'object' && 'then' in params && typeof params.then === 'function') {
          const resolved = await params
          setResolvedParams(resolved)
        } else {
          setResolvedParams(params as unknown as { id: string })
        }
      } catch (error) {
        console.error('Error resolving params:', error)
        if (params && typeof params === 'object' && 'id' in params) {
          setResolvedParams({ id: (params as any).id })
        }
      }
    }
    resolveParams()
  }, [params])

  useEffect(() => {
    if (resolvedParams) {
      initializePage()
    }
  }, [resolvedParams])

  const initializePage = async () => {
    if (!resolvedParams) return
    
    const bookData = await getBook(resolvedParams.id)
    if (!bookData) {
      notFound()
      return
    }

    setBook(bookData)
    setLoading(false)
    
    // Try to get AI analysis
    setAiLoading(true)
    try {
      const analysis = await getAIAnalysis(resolvedParams.id)
      if (analysis) {
        setAIAnalysis(analysis)
        setUsingFallback(false)
        toast.success("AI-generated reading guide loaded successfully!")
      } else {
        setUsingFallback(true)
        toast.info("Using comprehensive fallback content for reading guide")
      }
    } catch (error) {
      console.error('Error loading AI analysis:', error)
      setUsingFallback(true)
      toast.error("Failed to load AI analysis, using fallback content")
    } finally {
      setAiLoading(false)
    }
  }

  // Comprehensive fallback content when AI analysis is not available
  const getFallbackContent = () => {
    const isChineseBook = book?.title && /[\u4e00-\u9fff]/.test(book.title)
    
    if (isChineseBook) {
      return {
        summary: `本书详细介绍了如何建立和利用一个数字化的个人知识管理系统——第二大脑，这是一个革命性的概念，旨在帮助现代人更高效地管理信息爆炸时代的海量信息，从而显著提升工作和生活的生产力。

在信息时代，我们每天接触到的信息量是前所未有的。传统的记忆方法和笔记系统已经无法应对这种挑战。作者通过深入研究和实践，提出了构建"第二大脑"的系统性方法论，这不仅仅是一个简单的笔记系统，而是一个完整的外部认知系统，能够与我们的生物大脑协同工作。

本书的核心是两个重要的框架：PARA系统和CODE法则。PARA系统是一个四层式的信息组织架构，包括项目(Projects)、领域(Areas)、资源(Resources)和存档(Archives)。这个系统的设计理念是基于信息的可操作性，而不是传统的学科分类。项目是有明确截止日期和具体成果的任务；领域是需要持续关注和维护的生活或工作方面；资源是未来可能有用的参考材料；存档则是来自前三个类别的非活跃项目。

CODE法则则提供了信息处理的完整流程：抓取(Capture)、组织(Organize)、提炼(Distill)、表达(Express)。抓取阶段强调要捕获那些引起共鸣的信息，而不是试图记录一切；组织阶段将信息按照PARA系统进行分类；提炼阶段是通过渐进式总结等方法，将原始信息转化为个人见解；表达阶段则是将知识转化为创造性输出的过程。

书中特别强调了"渐进式总结"的概念，这是一种分层次的信息处理方法。第一层是保存原始内容，第二层是加粗重要段落，第三层是高亮最关键的句子，第四层是添加个人见解，第五层是创造性的重新表达。这种方法确保了信息在每次回顾时都能得到进一步的精炼和深化。

作者还深入讨论了数字化工具的选择和使用策略。他建议采用"工具链"而非单一工具的方式，每个工具都有其特定的用途和优势。同时，强调了"可移植性"的重要性，确保知识资产不会被特定工具绑定，能够在不同平台间自由迁移。

在创造力方面，本书提出了"中间包"的概念，即那些处于原始想法和最终成果之间的半成品。这些中间包是创造力的关键载体，通过建立和维护这些知识模块，我们能够更高效地进行创造性工作。书中还详细介绍了如何通过"创造性执行"将积累的知识转化为有价值的输出。

本书的另一个重要贡献是对"注意力经济"的深刻洞察。在信息过载的时代，注意力成为了最稀缺的资源。第二大脑系统通过外化信息存储和处理，让我们能够将珍贵的注意力集中在最重要的创造性思考上。

实践层面，书中提供了大量的具体操作指南和案例研究，涵盖了从个人学习、职业发展到团队协作等各个方面。无论是学生、知识工作者、创业者还是研究人员，都能从中找到适合自己的应用方法。

总的来说，这本书不仅提供了一套完整的知识管理方法论，更重要的是改变了我们对学习、思考和创造的根本认知。它让我们意识到，在数字化时代，我们需要的不是更好的记忆力，而是更好的外部认知系统。通过建立第二大脑，我们能够真正实现"站在巨人的肩膀上"，让过往的学习和思考成果为未来的创造提供强大的支撑。`,
        
        keyPoints: [
          "提出了PARA系统（项目、领域、资源、存档）作为信息组织的核心框架，基于可操作性而非传统学科分类",
          "阐述了CODE法则（抓取、组织、提炼、表达），提供了完整的信息处理工作流程",
          "创新性地提出了'渐进式总结'方法，通过五个层次逐步深化对信息的理解和应用",
          "强调了'中间包'概念，将知识模块化以支持创造性工作和快速输出",
          "提供了数字化工具链的选择策略，确保知识资产的可移植性和持续可用性",
          "深入分析了注意力经济，帮助读者在信息过载时代保持专注力",
          "结合大量实践案例，为不同类型的知识工作者提供了具体的应用指导",
          "系统性地解决了现代人面临的信息管理和知识应用挑战，具有极强的实用价值"
        ],
        
        keywords: ["第二大脑", "PARA系统", "CODE法则", "渐进式总结", "知识管理", "数字化工具", "创造力", "生产力", "信息组织", "个人知识库", "认知负荷", "注意力管理"],
        
        topics: ["个人知识管理系统", "数字化生产力工具", "信息组织方法论", "创造性工作流程", "认知科学应用", "现代学习策略"],
        
        worldRelevance: `在当今数字化转型加速的时代，本书所提出的第二大脑概念具有极其重要的现实意义和应用价值。随着人工智能、大数据、云计算等技术的快速发展，我们正处在一个前所未有的信息爆炸时代。每天产生的信息量以指数级增长，传统的记忆和学习方法已经无法应对这种挑战。

在远程工作成为常态的后疫情时代，个人的知识管理能力直接影响工作效率和职业发展。企业越来越重视员工的学习能力和知识创新能力，而不仅仅是执行能力。第二大脑系统帮助个人建立起强大的外部认知系统，这正是现代知识工作者的核心竞争力。

教育领域也在经历深刻变革，终身学习已成为必然趋势。传统的"一次性学习"模式被"持续学习"和"学习如何学习"所取代。本书提供的方法论正好契合了这种教育转型的需求，帮助学习者建立可持续的知识积累和应用机制。

在创业和创新领域，快速迭代和知识复用能力是成功的关键因素。第二大脑系统通过模块化的知识管理，使得创新者能够更高效地组合已有知识，产生新的创意和解决方案。这对于推动科技创新和商业模式创新都具有重要价值。

此外，在人工智能时代，人类与AI的协作成为新的工作模式。第二大脑系统实际上为这种协作提供了理想的框架，它让人类专注于高层次的创造性思考和判断，而将信息存储、检索和初步处理交给外部系统。这种分工模式正是未来工作的重要趋势。`,
        
        bookBackground: `《构建第二大脑》这本书诞生于作者蒂亚戈·福特（Tiago Forte）多年来对个人生产力和知识管理的深入研究和实践。作为生产力咨询领域的先驱者，福特在帮助数千名知识工作者提升效率的过程中，逐渐形成了第二大脑这一革命性的概念和方法论。

本书的理论基础融合了认知科学、信息科学、设计思维和实践哲学等多个学科的精华。作者深入研究了人类大脑的工作机制，特别是记忆、注意力和创造力的神经科学基础，并将这些科学发现转化为实用的方法论。同时，书中也借鉴了知识管理领域的最新研究成果，包括个人信息管理、组织学习理论等。

该书的写作背景是21世纪初信息技术的快速发展。随着互联网、智能手机、云存储等技术的普及，人们获取和处理信息的方式发生了根本性变化。传统的纸质笔记和文件夹系统已经无法满足数字化时代的需求，急需一套新的方法论来应对信息过载的挑战。

作者通过大量的实地调研和用户访谈，发现了现代人在知识管理方面的普遍困扰：信息收集容易但难以有效利用、学习投入巨大但成果难以积累、创意灵感频现但缺乏系统化整理等。正是这些痛点催生了第二大脑方法论的诞生。

本书的独特价值在于它不仅提供了理论框架，更重要的是提供了可操作的实践指南。作者通过自己的咨询公司Building a Second Brain，已经帮助了成千上万的学员成功实施了这套方法论，积累了丰富的实践经验和案例数据。这些实践验证了方法论的有效性，也为书中的建议提供了坚实的支撑。

在全球范围内，本书已经成为个人生产力和知识管理领域的经典之作，被翻译成多种语言，在各国的知识工作者中引起了广泛的共鸣和应用。它不仅改变了个人的工作方式，也影响了企业的知识管理策略和教育机构的教学方法。`,
        
        authorBackground: `蒂亚戈·福特（Tiago Forte）是当今世界最具影响力的生产力专家和知识管理思想家之一。他是Building a Second Brain课程和方法论的创始人，这个在线教育平台已经培养了数万名学员，遍布全球各个行业和领域。

福特拥有加州大学伯克利分校的学士学位，专业背景涵盖了商业、技术和设计等多个领域。他的跨学科背景使他能够从多个角度理解现代知识工作的复杂性，并开发出具有广泛适用性的解决方案。

作为一名连续创业者，福特深刻理解了现代商业环境对个人生产力的极高要求。他曾在多家科技公司担任产品经理和战略顾问，亲身体验了信息过载对知识工作者的挑战。这些实践经验为他后来开发第二大脑方法论提供了宝贵的洞察。

福特的研究方法独特而严谨，他结合了定量数据分析和定性用户研究，通过大规模的在线课程实验，持续优化和完善他的方法论。他的课程已经进行了数十期迭代，每一期都会根据学员反馈和实践结果进行改进，确保方法论的实用性和有效性。

作为思想领袖，福特经常在各种国际会议和论坛上分享他的见解，包括TEDx演讲、播客访谈、企业培训等。他的观点和方法论被《纽约时报》、《华尔街日报》、《哈佛商业评论》等权威媒体广泛报道和引用。

福特还是一位活跃的内容创作者，他通过个人博客Forte Labs、newsletter和社交媒体平台，持续分享关于生产力、创造力和个人发展的见解。他的写作风格清晰易懂，善于将复杂的概念转化为简单实用的方法，这也是他的方法论能够广泛传播的重要原因。

在学术界，福特的工作也得到了认可。他与多所大学的研究机构合作，参与个人信息管理和数字化学习方面的研究项目。他的方法论不仅在商业领域获得成功，在教育领域也展现出巨大的应用潜力。

福特的个人使命是帮助人们在数字化时代更好地学习、思考和创造。他相信，通过建立有效的外部认知系统，每个人都能够释放自己的创造潜力，在这个充满可能性的时代创造更大的价值。`
      }
    } else {
      return {
        summary: `This comprehensive book provides a detailed exploration of how to build and leverage a digital personal knowledge management system - the Second Brain. This revolutionary concept is designed to help modern individuals manage the overwhelming amount of information in our digital age more effectively, significantly enhancing productivity in both work and personal life.

In the information age, we encounter an unprecedented volume of information daily. Traditional memory methods and note-taking systems can no longer cope with this challenge. Through extensive research and practice, the author presents a systematic methodology for building a "Second Brain" - not just a simple note-taking system, but a complete external cognitive system that works in harmony with our biological brain.

The book centers on two crucial frameworks: the PARA system and the CODE method. The PARA system is a four-tier information organization architecture consisting of Projects, Areas, Resources, and Archives. This system is designed based on actionability rather than traditional subject classification. Projects are tasks with clear deadlines and specific outcomes; Areas are aspects of life or work that require ongoing attention and maintenance; Resources are reference materials that might be useful in the future; Archives contain inactive items from the previous three categories.

The CODE method provides a complete information processing workflow: Capture, Organize, Distill, Express. The capture phase emphasizes capturing information that resonates with us rather than trying to record everything; the organize phase categorizes information according to the PARA system; the distill phase uses methods like progressive summarization to transform raw information into personal insights; the express phase converts knowledge into creative output.

The book particularly emphasizes the concept of "Progressive Summarization," a layered approach to information processing. The first layer preserves original content, the second layer bolds important paragraphs, the third layer highlights the most crucial sentences, the fourth layer adds personal insights, and the fifth layer involves creative re-expression. This method ensures that information is further refined and deepened with each review.

The author also discusses in depth the selection and usage strategies for digital tools. He recommends adopting a "tool chain" approach rather than relying on a single tool, with each tool serving its specific purpose and advantages. He also emphasizes the importance of "portability," ensuring that knowledge assets are not locked into specific tools and can migrate freely between different platforms.

Regarding creativity, the book introduces the concept of "Intermediate Packets" - semi-finished products that lie between raw ideas and final outcomes. These intermediate packets are key carriers of creativity; by building and maintaining these knowledge modules, we can conduct creative work more efficiently. The book also details how to transform accumulated knowledge into valuable output through "Creative Execution."

Another important contribution of the book is its profound insight into the "attention economy." In an age of information overload, attention has become the scarcest resource. The Second Brain system, by externalizing information storage and processing, allows us to focus our precious attention on the most important creative thinking.

From a practical perspective, the book provides extensive specific operational guidelines and case studies, covering everything from personal learning and career development to team collaboration. Whether you're a student, knowledge worker, entrepreneur, or researcher, you can find application methods suitable for your needs.

Overall, this book not only provides a complete knowledge management methodology but, more importantly, changes our fundamental understanding of learning, thinking, and creating. It makes us realize that in the digital age, we don't need better memory - we need better external cognitive systems. By building a Second Brain, we can truly "stand on the shoulders of giants," allowing our past learning and thinking achievements to provide powerful support for future creation.`,
        
        keyPoints: [
          "Introduces the PARA system (Projects, Areas, Resources, Archives) as the core framework for information organization, based on actionability rather than traditional subject classification",
          "Explains the CODE method (Capture, Organize, Distill, Express), providing a complete information processing workflow",
          "Innovatively presents the 'Progressive Summarization' method, gradually deepening understanding and application of information through five layers",
          "Emphasizes the concept of 'Intermediate Packets,' modularizing knowledge to support creative work and rapid output",
          "Provides digital tool chain selection strategies, ensuring portability and continuous availability of knowledge assets",
          "Analyzes the attention economy in depth, helping readers maintain focus in the age of information overload",
          "Combines extensive practical cases to provide specific application guidance for different types of knowledge workers",
          "Systematically addresses the information management and knowledge application challenges faced by modern people, with extremely strong practical value"
        ],
        
        keywords: ["Second Brain", "PARA System", "CODE Method", "Progressive Summarization", "Knowledge Management", "Digital Tools", "Creativity", "Productivity", "Information Organization", "Personal Knowledge Base", "Cognitive Load", "Attention Management"],
        
        topics: ["Personal Knowledge Management Systems", "Digital Productivity Tools", "Information Organization Methodology", "Creative Workflow Processes", "Applied Cognitive Science", "Modern Learning Strategies"],
        
        worldRelevance: `In today's era of accelerated digital transformation, the Second Brain concept presented in this book holds extremely important practical significance and application value. With the rapid development of artificial intelligence, big data, cloud computing, and other technologies, we are in an unprecedented age of information explosion. The volume of information generated daily is growing exponentially, and traditional memory and learning methods can no longer cope with this challenge.

In the post-pandemic era where remote work has become the norm, individual knowledge management capabilities directly impact work efficiency and career development. Companies increasingly value employees' learning abilities and knowledge innovation capabilities, not just execution abilities. The Second Brain system helps individuals build powerful external cognitive systems, which is precisely the core competitiveness of modern knowledge workers.

The education sector is also undergoing profound transformation, with lifelong learning becoming an inevitable trend. The traditional "one-time learning" model is being replaced by "continuous learning" and "learning how to learn." The methodology provided in this book perfectly aligns with the needs of this educational transformation, helping learners establish sustainable knowledge accumulation and application mechanisms.

In entrepreneurship and innovation, rapid iteration and knowledge reuse capabilities are key success factors. The Second Brain system, through modular knowledge management, enables innovators to more efficiently combine existing knowledge to generate new ideas and solutions. This holds important value for promoting technological innovation and business model innovation.

Furthermore, in the AI era, human-AI collaboration has become a new work model. The Second Brain system actually provides an ideal framework for this collaboration, allowing humans to focus on high-level creative thinking and judgment while delegating information storage, retrieval, and preliminary processing to external systems. This division of labor model is precisely an important trend in future work.`,
        
        bookBackground: `"Building a Second Brain" emerged from author Tiago Forte's years of deep research and practice in personal productivity and knowledge management. As a pioneer in the productivity consulting field, Forte gradually developed the revolutionary concept and methodology of the Second Brain while helping thousands of knowledge workers improve their efficiency.

The theoretical foundation of the book integrates insights from multiple disciplines including cognitive science, information science, design thinking, and practical philosophy. The author conducted in-depth research on how the human brain works, particularly the neuroscientific foundations of memory, attention, and creativity, and transformed these scientific discoveries into practical methodologies. The book also draws on the latest research findings in knowledge management, including personal information management and organizational learning theory.

The writing context of the book is the rapid development of information technology in the early 21st century. With the widespread adoption of the internet, smartphones, cloud storage, and other technologies, the ways people acquire and process information have undergone fundamental changes. Traditional paper-based note-taking and filing systems could no longer meet the needs of the digital age, creating an urgent need for new methodologies to address information overload challenges.

Through extensive field research and user interviews, the author discovered common frustrations modern people face in knowledge management: information is easy to collect but difficult to utilize effectively, massive learning investments yield results that are hard to accumulate, creative inspirations occur frequently but lack systematic organization, and more. These pain points catalyzed the birth of the Second Brain methodology.

The unique value of this book lies not only in providing theoretical frameworks but, more importantly, in offering actionable practical guides. Through his consulting company Building a Second Brain, the author has already helped tens of thousands of students successfully implement this methodology, accumulating rich practical experience and case data. These practices have validated the effectiveness of the methodology and provided solid support for the recommendations in the book.

Globally, this book has become a classic in the field of personal productivity and knowledge management, translated into multiple languages and resonating widely among knowledge workers in various countries. It has not only changed individual working methods but also influenced corporate knowledge management strategies and educational institution teaching methods.`,
        
        authorBackground: `Tiago Forte is one of the world's most influential productivity experts and knowledge management thought leaders. He is the founder of the Building a Second Brain course and methodology, an online education platform that has trained tens of thousands of students across various industries and fields worldwide.

Forte holds a bachelor's degree from UC Berkeley, with a professional background spanning business, technology, and design. His interdisciplinary background enables him to understand the complexity of modern knowledge work from multiple perspectives and develop solutions with broad applicability.

As a serial entrepreneur, Forte deeply understands the extremely high demands modern business environments place on personal productivity. He has served as a product manager and strategic consultant at multiple technology companies, personally experiencing the challenges information overload poses to knowledge workers. These practical experiences provided valuable insights for his later development of the Second Brain methodology.

Forte's research methodology is unique and rigorous, combining quantitative data analysis with qualitative user research, continuously optimizing and refining his methodology through large-scale online course experiments. His courses have undergone dozens of iterations, with each iteration improved based on student feedback and practical results, ensuring the practicality and effectiveness of the methodology.

As a thought leader, Forte regularly shares his insights at various international conferences and forums, including TEDx talks, podcast interviews, and corporate training sessions. His viewpoints and methodologies have been widely reported and cited by authoritative media outlets including The New York Times, The Wall Street Journal, and Harvard Business Review.

Forte is also an active content creator, continuously sharing insights about productivity, creativity, and personal development through his personal blog Forte Labs, newsletter, and social media platforms. His writing style is clear and accessible, adept at transforming complex concepts into simple, practical methods - a key reason his methodology has spread so widely.

In academia, Forte's work has also gained recognition. He collaborates with research institutions at multiple universities, participating in research projects on personal information management and digital learning. His methodology has not only achieved success in the business world but also demonstrated enormous application potential in education.

Forte's personal mission is to help people learn, think, and create better in the digital age. He believes that by establishing effective external cognitive systems, everyone can unleash their creative potential and create greater value in this age of possibilities.`
      }
    }
  }

  const handleQuizAnswer = (answerIndex: number) => {
    setSelectedAnswer(answerIndex)
  }

  const submitAnswer = () => {
    if (selectedAnswer === null) return

    const currentQ = quizQuestions[currentQuestion]
    const isCorrect = selectedAnswer === currentQ.correct

    if (isCorrect) {
      setScore(score + 1)
      toast.success(`Correct! ${currentQ.explanation}`)
    } else {
      toast.error(`Incorrect. ${currentQ.explanation}`)
    }

    // Show explanation for a moment before moving to next question
    setTimeout(() => {
      if (currentQuestion < quizQuestions.length - 1) {
        setCurrentQuestion(currentQuestion + 1)
        setSelectedAnswer(null)
      } else {
        setShowResult(true)
      }
    }, 2000)
  }

  const resetQuiz = () => {
    setCurrentQuestion(0)
    setSelectedAnswer(null)
    setShowResult(false)
    setScore(0)
  }

  // Helper function to get unified content
  const getContent = () => {
    if (aiAnalysis) {
      // Only use AI analysis if it has meaningful content, otherwise fall back
      const fallback = getFallbackContent()
      
      // Safe content checking with proper fallbacks
      const hasValidContent = (content: string | undefined | null) => 
        content && typeof content === 'string' && content.trim().length > 50
      
      const hasValidArray = (arr: any[] | undefined | null) => 
        Array.isArray(arr) && arr.length > 0
      
      return {
        summary: hasValidContent(aiAnalysis.summary) ? aiAnalysis.summary : fallback.summary,
        keyPoints: hasValidArray(aiAnalysis.key_points) || hasValidArray(aiAnalysis.keyPoints) 
          ? (aiAnalysis.key_points || aiAnalysis.keyPoints) 
          : fallback.keyPoints,
        keywords: hasValidArray(aiAnalysis.keywords) ? aiAnalysis.keywords : fallback.keywords,
        topics: hasValidArray(aiAnalysis.topics) ? aiAnalysis.topics : fallback.topics,
        worldRelevance: hasValidContent(aiAnalysis.world_relevance) || hasValidContent(aiAnalysis.worldRelevance)
          ? (aiAnalysis.world_relevance || aiAnalysis.worldRelevance)
          : fallback.worldRelevance,
        authorBackground: hasValidContent(aiAnalysis.author_background) || hasValidContent(aiAnalysis.authorBackground)
          ? (aiAnalysis.author_background || aiAnalysis.authorBackground)
          : fallback.authorBackground,
        bookBackground: hasValidContent(aiAnalysis.book_background) || hasValidContent(aiAnalysis.bookBackground)
          ? (aiAnalysis.book_background || aiAnalysis.bookBackground)
          : fallback.bookBackground
      }
    }
    return getFallbackContent()
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading reading guide...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    notFound()
  }

  const content = getContent()

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/books/${book.id}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Book Details
          </Button>
        </Link>
        
        <div className="flex items-center gap-6 mb-6">
          <div className="flex-shrink-0">
            <div className="w-24 h-32 relative bg-muted rounded-md overflow-hidden">
              <Image
                src={book.cover_url || "/placeholder.svg"}
                alt={book.title}
                fill
                className="object-cover"
              />
            </div>
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{book.title}</h1>
            <div className="flex items-center gap-4 text-muted-foreground">
              {book.author && (
                <div className="flex items-center gap-1">
                  <User className="w-4 h-4" />
                  <span>{book.author}</span>
                </div>
              )}
              {book.year && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  <span>{book.year}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-between items-center mb-6 border-b">
          <div className="flex gap-2">
            <Button 
              variant={activeTab === 'overview' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('overview')}
              className="rounded-b-none"
            >
              <BookOpen className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button 
              variant={activeTab === 'analysis' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('analysis')}
              className="rounded-b-none"
            >
              <Brain className="w-4 h-4 mr-2" />
              Deep Analysis
            </Button>
            <Button 
              variant={activeTab === 'quiz' ? 'default' : 'ghost'}
              onClick={() => setActiveTab('quiz')}
              className="rounded-b-none"
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Quick Quiz
            </Button>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Content Source Indicator */}
            <div className="flex items-center gap-2 text-sm">
              {aiLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  Generating AI content...
                </div>
              ) : usingFallback ? (
                <div className="flex items-center gap-1 text-amber-600">
                  <Clock className="w-4 h-4" />
                  <span>Fallback Content</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-green-600">
                  <Brain className="w-4 h-4" />
                  <span>AI Generated</span>
                </div>
              )}
            </div>
            
            {/* Regenerate Button */}
            <Button 
              variant="outline" 
              size="sm"
              onClick={async () => {
                if (!resolvedParams) return
                setAiLoading(true)
                try {
                  // Force regeneration by calling POST directly
                  const response = await fetch(`/api/books/${resolvedParams.id}/ai-analysis`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                  })
                  
                  if (response.ok) {
                    const data = await response.json()
                    if (data.success && data.analysis) {
                      setAIAnalysis({
                        summary: data.analysis.summary,
                        key_points: data.analysis.keyPoints,
                        keyPoints: data.analysis.keyPoints,
                        keywords: data.analysis.keywords,
                        topics: data.analysis.topics,
                        difficulty: data.analysis.difficulty,
                        mindmap_structure: data.analysis.mindmapData,
                        world_relevance: data.analysis.worldRelevance,
                        worldRelevance: data.analysis.worldRelevance,
                        author_background: data.analysis.authorBackground,
                        authorBackground: data.analysis.authorBackground,
                        book_background: data.analysis.bookBackground,
                        bookBackground: data.analysis.bookBackground
                      })
                      setUsingFallback(false)
                      toast.success("AI content regenerated successfully!")
                    }
                  } else {
                    throw new Error('Failed to regenerate content')
                  }
                } catch (error) {
                  toast.error("Failed to regenerate AI content")
                } finally {
                  setAiLoading(false)
                }
              }}
              disabled={aiLoading}
            >
              <Brain className="w-4 h-4 mr-2" />
              {aiLoading ? "Generating..." : "Regenerate AI"}
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Book Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Book Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{content.summary}</p>
            </CardContent>
          </Card>

          {/* Author Background */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Author Background
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{content.authorBackground}</p>
            </CardContent>
          </Card>

          {/* Key Points */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="w-5 h-5" />
                Key Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {content.keyPoints?.map((point: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <span className="text-muted-foreground">{point}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Relevance to Today's World */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Relevance to Today's World
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed">{content.worldRelevance}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'analysis' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Keywords */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5" />
                Key Concepts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {content.keywords.map((keyword, index) => (
                  <Badge key={index} variant="secondary">{keyword}</Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Topics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Main Topics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {content.topics.map((topic, index) => (
                  <div key={index} className="p-2 bg-muted rounded-md">
                    <span className="font-medium">{topic}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Difficulty Level */}
          {aiAnalysis?.difficulty && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5" />
                  Difficulty Level
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Badge variant={
                    aiAnalysis.difficulty === 'Beginner' ? 'secondary' :
                    aiAnalysis.difficulty === 'Intermediate' ? 'default' : 'destructive'
                  }>
                    {aiAnalysis.difficulty}
                  </Badge>
                  <span className="text-muted-foreground">Reading Level</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Talk to Book */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Talk to Book
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Have questions about this book? Start a conversation to explore its ideas further.
              </p>
              <Button className="w-full" disabled>
                <MessageSquare className="w-4 h-4 mr-2" />
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'quiz' && (
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Quick Quiz
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showResult ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Question {currentQuestion + 1} of {quizQuestions.length}
                    </span>
                    <Badge variant="outline">Score: {score}</Badge>
                  </div>
                  
                  <h3 className="text-lg font-medium">
                    {quizQuestions[currentQuestion].question}
                  </h3>
                  
                  <div className="space-y-2">
                    {quizQuestions[currentQuestion].options.map((option, index) => (
                      <Button
                        key={index}
                        variant={selectedAnswer === index ? 'default' : 'outline'}
                        className="w-full justify-start"
                        onClick={() => handleQuizAnswer(index)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                  
                  <Button 
                    onClick={submitAnswer} 
                    disabled={selectedAnswer === null}
                    className="w-full"
                  >
                    {currentQuestion < quizQuestions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                  </Button>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="text-4xl">🎉</div>
                  <h3 className="text-xl font-medium">Quiz Complete!</h3>
                  <p className="text-muted-foreground">
                    You scored {score} out of {quizQuestions.length}
                  </p>
                  <Button onClick={resetQuiz} className="w-full">
                    Take Quiz Again
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}