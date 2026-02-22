"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  ArrowLeft, 
  BookOpen, 
  Eye, 
  Brain, 
  Target, 
  Tag, 
  Lightbulb, 
  TreePine, 
  FileText, 
  BarChart3,
  Clock,
  Star,
  User
} from "lucide-react"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { toast } from "sonner"
import dynamic from "next/dynamic"

// Dynamic import to avoid SSR issues with D3.js
const BookMindMap = dynamic(() => import("@/components/book-mindmap"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-64 bg-muted/20 rounded-lg">
      <div className="text-center space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="text-sm text-muted-foreground">Loading mindmap...</p>
      </div>
    </div>
  )
})

interface BookPreviewPageProps {
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
  isbn: string | null
  tags: string | null
  created_at: string
}

interface BookAnalysis {
  summary: string // Short summary for overview
  detailedSummary?: string // Extended 2-page summary for deep dive
  keyPoints: string[]
  keywords: string[]
  topics: string[]
  readingTime: number
  difficulty: "Beginner" | "Intermediate" | "Advanced"
  mindmapData: any
  authorBackground?: string
  bookBackground?: string
  worldRelevance?: string
  quizQuestions?: Array<{
    question: string
    options: string[]
    correct: number
    explanation: string
  }>
  confidence?: number
}

async function getBook(id: string) {
  const response = await fetch(`/api/books/${id}`, {
    cache: "no-store",
  })
  const result = await response.json().catch(() => null)

  if (!response.ok || !result?.success || !result?.book) {
    return null
  }
  return result.book as Book
}

// AI-powered book analysis function
async function analyzeBookWithAI(book: Book): Promise<BookAnalysis> {
  console.log('Starting AI analysis for book:', book.title)
  
  try {
    // Call the AI analysis API
    const response = await fetch(`/api/books/${book.id}/ai-analysis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    let errorData = { error: 'Unknown error', details: 'Network or parsing error' }
    
    if (!response.ok) {
      try {
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          errorData = await response.json()
        } else {
          // Handle HTML error responses (like 500 Internal Server Error pages)
          const textResponse = await response.text()
          console.error('Non-JSON error response:', textResponse.substring(0, 200))
          
          errorData = { 
            error: `Server Error (${response.status})`,
            details: response.status === 500 
              ? 'Internal server error - AI service may be unavailable'
              : `HTTP ${response.status}: ${response.statusText}`
          }
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError)
        errorData = { 
          error: `HTTP ${response.status}: ${response.statusText}`,
          details: 'Failed to get error details from server'
        }
      }
      
      console.warn('AI analysis API failed:', errorData)
      throw new Error(errorData.error || errorData.details || `HTTP ${response.status}`)
    }

    let data
    try {
      const contentType = response.headers.get('content-type')
      if (contentType && contentType.includes('application/json')) {
        data = await response.json()
      } else {
        const textResponse = await response.text()
        console.error('Expected JSON response, got:', textResponse.substring(0, 200))
        throw new Error('Server returned non-JSON response')
      }
    } catch (jsonError) {
      console.error('Failed to parse successful response as JSON:', jsonError)
      throw new Error('Invalid JSON response from AI service')
    }
    
    if (data.success && data.analysis) {
      if (data.fromCache) {
        console.log('✅ AI analysis retrieved from cache (instant)')
      } else {
        console.log('🆕 AI analysis generated fresh from OpenAI')
      }
      return {
        summary: data.analysis.summary,
        keyPoints: data.analysis.keyPoints,
        keywords: data.analysis.keywords,
        topics: data.analysis.topics,
        readingTime: data.analysis.readingTime,
        difficulty: data.analysis.difficulty,
        mindmapData: data.analysis.mindmapData
      }
    } else {
      throw new Error(data.error || 'Invalid analysis response format')
    }
  } catch (error) {
    console.error('AI analysis failed:', error)
    // Re-throw the error to be handled by the calling function
    throw error
  }
}

// Fallback function for when AI analysis fails
function generateFallbackAnalysis(book: Book): BookAnalysis {
  console.log('Using fallback analysis for:', book.title)
  
  const mockAnalysis: BookAnalysis = {
    summary: `${book.title} by ${book.author || 'Unknown Author'} represents a comprehensive and thoughtful exploration of its subject domain, providing readers with an extensive examination of key themes, methodologies, and practical applications. This substantial work demonstrates the author's deep understanding of the field through its careful balance of theoretical foundations and real-world implementations.

The book's systematic approach to complex topics makes it accessible to diverse audiences while maintaining the scholarly rigor expected by professionals and academics. Through detailed analysis and well-researched examples, readers gain both conceptual understanding and practical tools that can be applied in various contexts and situations.

What sets this work apart is its commitment to bridging the gap between theory and practice, offering actionable insights that extend beyond abstract concepts. The author skillfully presents multiple perspectives on important issues, encouraging critical thinking while providing clear guidance for implementation. Whether used as a comprehensive introduction to the field or as an advanced reference guide, this book delivers substantial value to readers seeking both foundational knowledge and practical expertise in its subject area.`,
    keyPoints: [
      "Comprehensive exploration of core concepts and principles",
      "Practical applications and real-world examples",
      "Evidence-based insights and research findings",
      "Step-by-step methodologies and frameworks",
      "Contemporary relevance and future implications",
      "Integration of multiple perspectives and approaches"
    ],
    keywords: [
      "methodology",
      "framework",
      "analysis", 
      "principles",
      "implementation",
      "strategy",
      "insights",
      "research",
      "concepts",
      "applications",
      "best practices",
      "case studies"
    ],
    topics: [
      "Foundational Concepts",
      "Practical Applications", 
      "Case Studies",
      "Methodologies",
      "Future Trends",
      "Implementation Strategies"
    ],
    readingTime: Math.floor(Math.random() * 480) + 120, // 2-10 hours
    difficulty: ["Beginner", "Intermediate", "Advanced"][Math.floor(Math.random() * 3)] as "Beginner" | "Intermediate" | "Advanced",
    mindmapData: {
      name: book.title,
      children: [
        {
          name: "Key Concepts",
          children: [
            { name: "Foundational Principles", children: [
              { name: "Core Theory" },
              { name: "Historical Context" },
              { name: "Modern Developments" }
            ]},
            { name: "Methodologies", children: [
              { name: "Research Methods" },
              { name: "Analysis Techniques" },
              { name: "Implementation Frameworks" }
            ]}
          ]
        },
        {
          name: "Applications",
          children: [
            { name: "Real-world Examples", children: [
              { name: "Case Study 1" },
              { name: "Case Study 2" },
              { name: "Industry Applications" }
            ]},
            { name: "Best Practices", children: [
              { name: "Guidelines" },
              { name: "Common Pitfalls" },
              { name: "Success Strategies" }
            ]}
          ]
        },
        {
          name: "Impact & Future",
          children: [
            { name: "Current Trends", children: [
              { name: "Emerging Technologies" },
              { name: "Market Developments" },
              { name: "Social Implications" }
            ]},
            { name: "Future Directions", children: [
              { name: "Research Opportunities" },
              { name: "Innovation Potential" },
              { name: "Long-term Vision" }
            ]}
          ]
        }
      ]
    }
  }

  // Customize based on book tags if available
  if (book.tags) {
    const bookTags = book.tags.split(",").map(tag => tag.trim().toLowerCase())
    
    // Add book-specific keywords from tags
    mockAnalysis.keywords = [...mockAnalysis.keywords, ...bookTags.slice(0, 5)]
    
    // Customize topics based on tags
    if (bookTags.includes("technology") || bookTags.includes("programming")) {
      mockAnalysis.topics.push("Technical Implementation", "Software Development")
    }
    if (bookTags.includes("business") || bookTags.includes("management")) {
      mockAnalysis.topics.push("Business Strategy", "Leadership Principles")
    }
    if (bookTags.includes("science") || bookTags.includes("research")) {
      mockAnalysis.topics.push("Scientific Methods", "Research Methodology")
    }
  }

  return mockAnalysis
}

export default function BookPreviewPage({ params }: BookPreviewPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [analysis, setAnalysis] = useState<BookAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [analysisError, setAnalysisError] = useState<string | null>(null)
  const [usingAI, setUsingAI] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "details" | "mindmap">("overview")

  // Resolve params (handle both Promise and direct object cases)
  useEffect(() => {
    const resolveParams = async () => {
      try {
        // Check if params is a Promise
        if (params && typeof params === 'object' && 'then' in params && typeof params.then === 'function') {
          // params is a Promise
          const resolved = await params
          setResolvedParams(resolved)
        } else {
          // params is a direct object
          setResolvedParams(params as unknown as { id: string })
        }
      } catch (error) {
        console.error('Error resolving params:', error)
        // Fallback: try to extract id directly
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

  const retryAnalysis = async () => {
    if (!book) return
    
    setAnalysisLoading(true)
    setAnalysisError(null)
    
    try {
      const bookAnalysis = await analyzeBookWithAI(book)
      setAnalysis(bookAnalysis)
      setUsingAI(true)
      toast.success("Analysis completed successfully!")
    } catch (error) {
      console.error('Failed to get AI analysis:', error)
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
      setAnalysisError(errorMessage)
      
      // Use fallback analysis on error
      const fallbackAnalysis = generateFallbackAnalysis(book)
      setAnalysis(fallbackAnalysis)
      setUsingAI(false)
      
      // Provide specific user feedback based on error type
      if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
        toast.info("AI service not configured. Using enhanced basic analysis.")
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        toast.warning("AI service temporarily unavailable. Using basic analysis instead.")
      } else {
        toast.error("AI analysis failed. Using basic analysis instead.")
      }
    } finally {
      setAnalysisLoading(false)
    }
  }

  const initializePage = async () => {
    if (!resolvedParams) return
    
    const bookData = await getBook(resolvedParams.id)

    if (!bookData) {
      notFound()
      return
    }

    setBook(bookData)
    setLoading(false)
    
    // Generate analysis using AI service with timeout
    setAnalysisLoading(true)
    setAnalysisError(null)
    
    try {
      // Add a timeout to the AI analysis (120 seconds / 2 minutes)
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('AI analysis timed out')), 120000)
      })
      
      const analysisPromise = analyzeBookWithAI(bookData)
      
      const bookAnalysis = await Promise.race([analysisPromise, timeoutPromise]) as BookAnalysis
      setAnalysis(bookAnalysis)
      setUsingAI(true)
      toast.success("AI analysis completed!")
    } catch (error) {
      console.error('Failed to get AI analysis:', error)
      const errorMessage = error instanceof Error ? error.message : 'Analysis failed'
      setAnalysisError(errorMessage)
      
      // Use fallback analysis on error
      const fallbackAnalysis = generateFallbackAnalysis(bookData)
      setAnalysis(fallbackAnalysis)
      setUsingAI(false)
      
      // Provide specific user feedback based on error type
      if (errorMessage.includes('timed out')) {
        toast.error("AI analysis is taking longer than expected. Using basic analysis instead.")
      } else if (errorMessage.includes('API key') || errorMessage.includes('not configured')) {
        toast.info("AI service not configured. Using enhanced basic analysis.")
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
        toast.warning("AI service temporarily unavailable. Using basic analysis instead.")
      } else {
        toast.error("AI analysis failed. Using basic analysis instead.")
      }
    } finally {
      setAnalysisLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <div className="space-y-2">
              <p className="text-lg font-medium">Generating AI Analysis</p>
              <p className="text-muted-foreground">This may take 15-30 seconds...</p>
              <p className="text-sm text-muted-foreground">Please wait while we analyze the book content with AI</p>
            </div>
            <div className="flex justify-center">
              <div className="flex space-x-1">
                <div className="animate-bounce h-2 w-2 bg-primary rounded-full" style={{animationDelay: '0ms'}}></div>
                <div className="animate-bounce h-2 w-2 bg-primary rounded-full" style={{animationDelay: '150ms'}}></div>
                <div className="animate-bounce h-2 w-2 bg-primary rounded-full" style={{animationDelay: '300ms'}}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show analysis loading state when book is loaded but analysis is still processing
  if (book && analysisLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-6">
          <Link href={`/books/${book.id}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Book Details
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Book Info Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-4">
              <CardContent className="p-6">
                <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden">
                  <Image
                    src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                    alt={book.title || "Book cover"}
                    fill
                    className="object-cover"
                    sizes="300px"
                    priority
                    onError={(e) => {
                      e.currentTarget.src = "/abstract-book-cover.png"
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{book.title}</h3>
                  {book.author && (
                    <p className="text-muted-foreground text-sm">{book.author}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Analysis Loading Content */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-center min-h-[500px]">
              <div className="text-center space-y-4">
                <Brain className="w-16 h-16 text-primary mx-auto animate-pulse" />
                <div className="space-y-2">
                  <p className="text-xl font-semibold">AI Analysis in Progress</p>
                  <p className="text-muted-foreground">Generating intelligent insights for "{book.title}"</p>
                  <p className="text-sm text-muted-foreground">This typically takes 15-30 seconds</p>
                </div>
                <div className="flex justify-center">
                  <div className="flex space-x-1">
                    <div className="animate-bounce h-3 w-3 bg-primary rounded-full" style={{animationDelay: '0ms'}}></div>
                    <div className="animate-bounce h-3 w-3 bg-primary rounded-full" style={{animationDelay: '150ms'}}></div>
                    <div className="animate-bounce h-3 w-3 bg-primary rounded-full" style={{animationDelay: '300ms'}}></div>
                  </div>
                </div>
                {analysisError && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600 text-sm">Analysis failed: {analysisError}</p>
                    <p className="text-red-500 text-xs mt-1">Using fallback analysis...</p>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={retryAnalysis}
                      disabled={analysisLoading}
                    >
                      Retry AI Analysis
                    </Button>
                  </div>
                )}
                
                {!analysisError && (
                  <div className="mt-6">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        // Cancel current analysis and use fallback
                        const fallbackAnalysis = generateFallbackAnalysis(book!)
                        setAnalysis(fallbackAnalysis)
                        setUsingAI(false)
                        setAnalysisLoading(false)
                        toast.info("Switched to quick analysis")
                      }}
                    >
                      Skip AI Analysis (Use Basic Analysis)
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!book || !analysis) {
    notFound()
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "Beginner": return "bg-green-100 text-green-800 border-green-300"
      case "Intermediate": return "bg-yellow-100 text-yellow-800 border-yellow-300"  
      case "Advanced": return "bg-red-100 text-red-800 border-red-300"
      default: return "bg-gray-100 text-gray-800 border-gray-300"
    }
  }

  const formatReadingTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link href={`/books/${book.id}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Book Details
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Book Info Sidebar */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardContent className="p-6">
              <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden">
                <Image
                  src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                  alt={book.title || "Book cover"}
                  fill
                  className="object-cover"
                  sizes="300px"
                  priority
                  onError={(e) => {
                    e.currentTarget.src = "/abstract-book-cover.png"
                  }}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{book.title}</h3>
                  {book.author && (
                    <p className="text-muted-foreground text-sm">{book.author}</p>
                  )}
                </div>

                {/* Quick Stats */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-muted-foreground" />
                    <span>~{formatReadingTime(analysis.readingTime)}</span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-muted-foreground" />
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getDifficultyColor(analysis.difficulty)}`}
                    >
                      {analysis.difficulty}
                    </Badge>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-4">
                  <Button className="w-full" asChild>
                    <Link href={`/books/${book.id}/reader`}>
                      <BookOpen className="w-4 h-4 mr-2" />
                      Read Book
                    </Link>
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setActiveTab("details")}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    View Deep Dive
                  </Button>
                  
                  <Button variant="ghost" size="sm" className="w-full" asChild>
                    <Link href={`/books/${book.id}`}>
                      <FileText className="w-4 h-4 mr-2" />
                      Book Info
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Tab Navigation */}
          <div className="flex gap-2 border-b border-border">
            <Button
              variant={activeTab === "overview" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("overview")}
              className="mb-2"
            >
              <FileText className="w-4 h-4 mr-2" />
              Overview
            </Button>
            <Button
              variant={activeTab === "details" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("details")}
              className="mb-2"
            >
              <Eye className="w-4 h-4 mr-2" />
              Deep Dive
            </Button>
            <Button
              variant={activeTab === "mindmap" ? "default" : "ghost"}
              size="sm"
              onClick={() => setActiveTab("mindmap")}
              className="mb-2"
            >
              <TreePine className="w-4 h-4 mr-2" />
              Mind Map
            </Button>
          </div>

          {activeTab === "overview" && (
            <div className="space-y-6">
              {/* AI Analysis Status */}
              {(usingAI || analysisError || analysisLoading) && (
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {analysisLoading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                            <span className="text-sm text-muted-foreground">Analyzing with AI...</span>
                          </>
                        ) : usingAI ? (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm text-green-700">✨ AI-Powered Analysis</span>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="ml-4 h-7 text-xs"
                              onClick={async () => {
                                if (!book) return
                                if (!confirm('Regenerate AI analysis? This will create a new analysis with updated insights.')) return
                                setAnalysisLoading(true)
                                setAnalysisError(null)
                                try {
                                  // Force regenerate by adding forceRegenerate parameter with timestamp to prevent caching
                                  const timestamp = Date.now()
                                  const response = await fetch(`/api/books/${book.id}/ai-analysis?forceRegenerate=true&t=${timestamp}`, {
                                    method: 'POST',
                                    headers: { 
                                      'Content-Type': 'application/json',
                                      'Cache-Control': 'no-cache'
                                    }
                                  })
                                  const data = await response.json()
                                  if (data.success && data.analysis) {
                                    setAnalysis({
                                      summary: data.analysis.summary,
                                      detailedSummary: data.analysis.detailedSummary,
                                      keyPoints: data.analysis.keyPoints || [],
                                      keywords: data.analysis.keywords || [],
                                      topics: data.analysis.topics || [],
                                      readingTime: data.analysis.readingTime || 60,
                                      difficulty: data.analysis.difficulty || 'Intermediate',
                                      mindmapData: data.analysis.mindmapData || {},
                                      authorBackground: data.analysis.authorBackground,
                                      bookBackground: data.analysis.bookBackground,
                                      worldRelevance: data.analysis.worldRelevance,
                                      quizQuestions: data.analysis.quizQuestions,
                                      confidence: data.analysis.confidence
                                    })
                                    setUsingAI(true)
                                    toast.success('Analysis regenerated successfully!')
                                  }
                                } catch (error) {
                                  console.error('Failed to regenerate analysis:', error)
                                  toast.error('Failed to regenerate analysis')
                                } finally {
                                  setAnalysisLoading(false)
                                }
                              }}
                            >
                              🔄 Regenerate
                            </Button>
                          </>
                        ) : analysisError ? (
                          <>
                            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                            <span className="text-sm text-yellow-700">Using fallback analysis</span>
                          </>
                        ) : null}
                      </div>
                      
                      {analysisError && !analysisLoading && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={async () => {
                            if (!book) return
                            setAnalysisLoading(true)
                            setAnalysisError(null)
                            try {
                              const bookAnalysis = await analyzeBookWithAI(book)
                              setAnalysis(bookAnalysis)
                              setUsingAI(true)
                            } catch (error) {
                              setAnalysisError(error instanceof Error ? error.message : 'Analysis failed')
                            } finally {
                              setAnalysisLoading(false)
                            }
                          }}
                        >
                          Retry AI Analysis
                        </Button>
                      )}
                    </div>
                    
                    {analysisError && (
                      <p className="text-xs text-muted-foreground mt-2">
                        AI analysis unavailable: {analysisError}
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Summary Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Book Summary
                    {analysisLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisLoading ? (
                    <div className="space-y-2">
                      <div className="h-4 bg-muted animate-pulse rounded"></div>
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
                      <div className="h-4 bg-muted animate-pulse rounded w-1/2"></div>
                    </div>
                  ) : (
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {analysis?.summary}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Key Points */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Key Points
                    {analysisLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {analysisLoading ? (
                    <div className="space-y-3">
                      {[...Array(6)].map((_, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-muted animate-pulse flex-shrink-0 mt-0.5"></div>
                          <div className="flex-1 space-y-1">
                            <div className="h-3 bg-muted animate-pulse rounded w-full"></div>
                            <div className="h-3 bg-muted animate-pulse rounded w-3/4"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {analysis?.keyPoints.map((point, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-sm font-medium text-primary">{index + 1}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{point}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Keywords & Topics */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Keywords */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Tag className="w-5 h-5" />
                      Keywords
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {analysis.keywords.map((keyword, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Topics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      Main Topics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {analysis.topics.map((topic, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-primary" />
                          <span className="text-sm">{topic}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-6">
              {/* About the Author */}
              {analysis.authorBackground && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      About the Author
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                      {analysis.authorBackground}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Book Background & Context */}
              {analysis.bookBackground && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Book Background & Context
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                      {analysis.bookBackground}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* World Relevance & Impact */}
              {analysis.worldRelevance && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5" />
                      Relevance & Real-World Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                      {analysis.worldRelevance}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Extended Summary - 2 pages */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    In-Depth Summary (2 Pages)
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    A comprehensive analysis covering the entire book (800-1000 words)
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                      {analysis.summary}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Quiz Questions */}
              {analysis.quizQuestions && analysis.quizQuestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      Comprehension Questions
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Test your understanding of the key concepts
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {analysis.quizQuestions.map((quiz, index) => (
                        <div key={index} className="border-l-4 border-primary/30 pl-4">
                          <p className="font-medium mb-3">{index + 1}. {quiz.question}</p>
                          <div className="space-y-2 ml-4">
                            {quiz.options.map((option, optIndex) => (
                              <div 
                                key={optIndex} 
                                className={`p-2 rounded-md text-sm ${
                                  optIndex === quiz.correct 
                                    ? 'bg-green-50 border border-green-200 text-green-900' 
                                    : 'bg-muted/30'
                                }`}
                              >
                                <span className="font-medium">{String.fromCharCode(65 + optIndex)}.</span> {option}
                                {optIndex === quiz.correct && (
                                  <span className="ml-2 text-green-600 text-xs">✓ Correct</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            💡 {quiz.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Book Metadata */}
              {book.description && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="w-5 h-5" />
                      Publisher's Description
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {book.description}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Additional Book Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Tag className="w-5 h-5" />
                    Book Details
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {book.publisher && (
                      <div>
                        <p className="text-sm text-muted-foreground">Publisher</p>
                        <p className="font-medium">{book.publisher}</p>
                      </div>
                    )}
                    {book.year && (
                      <div>
                        <p className="text-sm text-muted-foreground">Year</p>
                        <p className="font-medium">{book.year}</p>
                      </div>
                    )}
                    {book.isbn && (
                      <div>
                        <p className="text-sm text-muted-foreground">ISBN</p>
                        <p className="font-medium">{book.isbn}</p>
                      </div>
                    )}
                    {book.tags && (
                      <div className="md:col-span-2">
                        <p className="text-sm text-muted-foreground mb-2">Tags</p>
                        <div className="flex flex-wrap gap-2">
                          {book.tags.split(',').map((tag, index) => (
                            <Badge key={index} variant="outline">
                              {tag.trim()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === "details" && (
            <div className="space-y-6">
              {/* Author Background */}
              {analysis.authorBackground && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="w-5 h-5" />
                      Author Background
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                      {analysis.authorBackground}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Book Background */}
              {analysis.bookBackground && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      Book Background & Context
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                      {analysis.bookBackground}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Detailed Summary - 2 pages */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="w-5 h-5" />
                    Detailed Summary (2 pages)
                    {analysisLoading && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary ml-2"></div>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    Comprehensive 800-1000 word analysis covering all major aspects
                  </p>
                </CardHeader>
                <CardContent>
                  {analysisLoading ? (
                    <div className="space-y-3">
                      <div className="h-4 bg-muted animate-pulse rounded"></div>
                      <div className="h-4 bg-muted animate-pulse rounded"></div>
                      <div className="h-4 bg-muted animate-pulse rounded w-3/4"></div>
                      <div className="h-4 bg-muted animate-pulse rounded"></div>
                      <div className="h-4 bg-muted animate-pulse rounded w-5/6"></div>
                    </div>
                  ) : (
                    <div className="prose prose-sm max-w-none">
                      <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                        {analysis?.summary}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* World Relevance */}
              {analysis.worldRelevance && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5" />
                      Relevance & Impact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-base leading-relaxed text-muted-foreground whitespace-pre-line">
                      {analysis.worldRelevance}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Quiz Questions */}
              {analysis.quizQuestions && analysis.quizQuestions.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5" />
                      Comprehension Questions
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Test your understanding of the key concepts
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {analysis.quizQuestions.map((quiz, index) => (
                        <div key={index} className="border-l-4 border-primary/30 pl-4">
                          <p className="font-medium mb-3">{index + 1}. {quiz.question}</p>
                          <div className="space-y-2 ml-4">
                            {quiz.options.map((option, optIndex) => (
                              <div 
                                key={optIndex} 
                                className={`p-2 rounded-md text-sm ${
                                  optIndex === quiz.correct 
                                    ? 'bg-green-50 border border-green-200 text-green-900' 
                                    : 'bg-muted/30'
                                }`}
                              >
                                <span className="font-medium">{String.fromCharCode(65 + optIndex)}.</span> {option}
                                {optIndex === quiz.correct && (
                                  <span className="ml-2 text-green-600 text-xs">✓ Correct</span>
                                )}
                              </div>
                            ))}
                          </div>
                          <p className="text-sm text-muted-foreground mt-2 italic">
                            💡 {quiz.explanation}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {activeTab === "mindmap" && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TreePine className="w-5 h-5" />
                    Knowledge Structure
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Interactive mind map showing the book's key concepts and their relationships
                  </p>
                </CardHeader>
                <CardContent className="p-2">
                  <div className="h-96 w-full border border-border rounded-lg overflow-hidden relative">
                    <BookMindMap data={analysis.mindmapData} />
                  </div>
                </CardContent>
              </Card>

              {/* Mindmap Legend */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">How to Use the Mind Map</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <p>• <strong>Click and drag</strong> to navigate around the map</p>
                    <p>• <strong>Scroll</strong> to zoom in and out</p>
                    <p>• <strong>Click nodes</strong> to expand/collapse branches</p>
                    <p>• The central node represents the book's main theme</p>
                    <p>• Branch nodes show major concepts and subtopics</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
