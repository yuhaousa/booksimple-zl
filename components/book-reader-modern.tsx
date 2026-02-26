'use client'

import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import dynamic from 'next/dynamic'

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`

// Dynamic import for mind map (client-side only)
const BookMindMapAI = dynamic(() => import('@/components/book-mindmap-ai'), { ssr: false })

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  ChevronLeft, 
  ChevronRight,
  BookOpen,
  Highlighter,
  StickyNote,
  Menu,
  X,
  Plus,
  Trash2,
  BookMarked,
  Palette,
  FileText,
  Calendar,
  Layout,
  Sun,
  Moon,
  Coffee
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#FBBF24', class: 'bg-yellow-400' },
  { name: 'Sage', value: '#3B82F6', class: 'bg-[#7aaa87]' },
  { name: 'Green', value: '#10B981', class: 'bg-green-400' },
  { name: 'Pink', value: '#EC4899', class: 'bg-pink-400' },
  { name: 'Moss', value: '#8B5CF6', class: 'bg-[#b2cebb]' },
]

// Reading mode styles
const getReadingModeStyles = (mode: 'light' | 'dark' | 'sepia') => {
  switch (mode) {
    case 'dark':
      return {
        background: 'bg-gray-900',
        sidebar: 'bg-gray-800 border-gray-700',
        card: 'bg-gray-800 border-gray-700',
        text: 'text-gray-100',
        textMuted: 'text-gray-400',
        filter: 'invert(0.9) hue-rotate(180deg)'
      }
    case 'sepia':
      return {
        background: 'bg-[#f4ecd8]',
        sidebar: 'bg-[#e8dcc4] border-[#d4c4a8]',
        card: 'bg-[#e8dcc4] border-[#d4c4a8]',
        text: 'text-[#5c4f3a]',
        textMuted: 'text-[#8c7a5a]',
        filter: 'sepia(0.3) saturate(0.8)'
      }
    default: // light
      return {
        background: 'bg-white',
        sidebar: 'bg-white border-gray-200',
        card: 'bg-white border-gray-200',
        text: 'text-gray-900',
        textMuted: 'text-gray-500',
        filter: 'none'
      }
  }
}

interface Book {
  id: number
  title: string
  author: string | null
  file_url: string | null
}

interface Highlight {
  id: number
  book_id: number
  user_id: string
  text: string
  color: string
  page_number: number
  position: any
  created_at: string
}

interface Note {
  id: number
  book_id: number
  user_id: string
  content: string
  page_number: number
  position: any
  created_at: string
  updated_at: string
}

interface Outline {
  title: string
  page: number
  items?: Outline[]
}

interface BookReaderProps {
  book: Book
}

export function ModernBookReader({ book }: BookReaderProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.2)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [readingMode, setReadingMode] = useState<'light' | 'dark' | 'sepia'>('light')
  
  // Sidebar state
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true)
  const [activeRightTab, setActiveRightTab] = useState<'highlights' | 'notes' | 'outline' | 'guide'>('guide')
  
  // Highlights and Notes
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [outline, setOutline] = useState<Outline[]>([])
  const [selectedHighlightColor, setSelectedHighlightColor] = useState(HIGHLIGHT_COLORS[0])
  const [isHighlightMode, setIsHighlightMode] = useState(false)
  
  // AI Guide and Analysis
  const [aiGuide, setAiGuide] = useState<string | null>(null)
  const [aiOutline, setAiOutline] = useState<any | null>(null)
  const [loadingAiData, setLoadingAiData] = useState(false)
  
  // New note form
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [newNoteContent, setNewNoteContent] = useState('')
  
  const pageRef = useRef<HTMLDivElement>(null)
  const styles = getReadingModeStyles(readingMode)

  const getCurrentUserId = async () => {
    const response = await fetch('/api/auth/me', { cache: 'no-store' })
    const result = await response.json().catch(() => null)
    return result?.success && result?.user?.id ? String(result.user.id) : null
  }

  useEffect(() => {
    loadBookData()
  }, [book.id])

  // Load reading mode preference
  useEffect(() => {
    const savedMode = localStorage.getItem(`reader-mode-${book.id}`)
    if (savedMode === 'dark' || savedMode === 'sepia' || savedMode === 'light') {
      setReadingMode(savedMode)
    }
  }, [book.id])

  // Save reading mode preference
  useEffect(() => {
    localStorage.setItem(`reader-mode-${book.id}`, readingMode)
  }, [readingMode, book.id])

  // Track reading progress
  useEffect(() => {
    const updateProgress = async () => {
      if (!numPages || !pageNumber || pageNumber < 1 || pageNumber > numPages) return

      try {
        const userId = await getCurrentUserId()
        if (!userId) return

        const response = await fetch('/api/book-tracking', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-id': userId,
          },
          body: JSON.stringify({
            book_id: book.id,
            current_page: pageNumber,
            total_pages: numPages,
          }),
        })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.success) {
          throw new Error(result?.details || result?.error || 'Failed to update reading progress')
        }
      } catch (err) {
        console.error('Failed to update reading progress:', err)
      }
    }

    const timeoutId = setTimeout(updateProgress, 1000)
    return () => clearTimeout(timeoutId)
  }, [pageNumber, numPages, book.id])

  const loadBookData = async () => {
    try {
      const userId = await getCurrentUserId()
      if (!userId) return

      const response = await fetch(`/api/books/${book.id}/reader-data`, {
        cache: 'no-store',
        headers: {
          'x-user-id': userId,
        },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || 'Failed to load reader data')
      }

      setHighlights(Array.isArray(result.highlights) ? result.highlights : [])
      setNotes(Array.isArray(result.notes) ? result.notes : [])

      // Load AI analysis
      loadAiAnalysis()
    } catch (error) {
      console.error('Error loading book data:', error)
    }
  }

  const loadAiAnalysis = async () => {
    try {
      setLoadingAiData(true)
      
      console.log('Loading AI analysis for book:', book.id)

      const response = await fetch(`/api/ai-book-analysis?bookId=${book.id}`, { cache: 'no-store' })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        console.error('Error fetching AI analysis:', result)
        return
      }

      const aiData = result.analysis || null

      if (aiData) {
        console.log('AI analysis loaded:', { 
          hasSummary: !!aiData.summary, 
          hasMindMap: !!aiData.mind_map_data,
          hasContentAnalysis: !!aiData.content_analysis
        })
        
        // Use summary as reading guide
        setAiGuide(aiData.summary || null)
        // Use mind_map_data or content_analysis for the outline
        setAiOutline(aiData.mind_map_data || aiData.content_analysis || null)
      } else {
        console.log('No AI analysis found for this book')
        setAiGuide(null)
        setAiOutline(null)
      }
    } catch (error) {
      console.error('Error loading AI analysis:', error)
    } finally {
      setLoadingAiData(false)
    }
  }

  const generateMindMap = async (forceRegenerate: boolean = false) => {
    try {
      setLoadingAiData(true)
      
      if (forceRegenerate) {
        toast.info('正在重新生成思维导图...')
      } else {
        toast.info('正在加载思维导图...')
      }
      
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        toast.error('请先登录')
        setLoadingAiData(false)
        return
      }

      const bookId = book?.id
      const userId = user.id
      
      console.log('Generating mind map for book:', bookId, 'user:', userId)

      // Call API to generate mind map using AI
      const response = await fetch('/api/generate-mindmap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          bookId: bookId,
          userId: userId,
          forceRegenerate: forceRegenerate
        })
      })

      console.log('API response status:', response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('API error response:', errorText)
        let errorMessage = 'Failed to generate mind map'
        try {
          const error = JSON.parse(errorText)
          errorMessage = error.error || errorMessage
        } catch (e) {
          errorMessage = errorText || errorMessage
        }
        throw new Error(errorMessage)
      }

      const result = await response.json()
      console.log('API result:', result)
      
      if (result.success) {
        setAiGuide(result.data.summary)
        setAiOutline(result.data.mindMapData)
        
        if (result.cached) {
          toast.success('已加载缓存的思维导图')
        } else {
          toast.success('思维导图生成成功！')
        }
      } else {
        throw new Error('Failed to generate mind map')
      }
    } catch (error: any) {
      console.error('Error generating mind map:', error)
      toast.error(error.message || '生成思维导图失败，请稍后重试')
    } finally {
      setLoadingAiData(false)
    }
  }

  const onDocumentLoadSuccess = async ({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setIsLoading(false)
    setPdfError(null)

    // Try to load PDF outline
    try {
      const loadingTask = pdfjs.getDocument(book.file_url || '')
      const pdf = await loadingTask.promise
      const pdfOutline = await pdf.getOutline()
      
      if (pdfOutline) {
        const processOutline = (items: any[]): Outline[] => {
          return items.map(item => ({
            title: item.title,
            page: 1,
            items: item.items ? processOutline(item.items) : undefined
          }))
        }
        setOutline(processOutline(pdfOutline))
      }
    } catch (err) {
      console.log('No outline available')
    }
  }

  const onDocumentLoadError = (error: any) => {
    console.error('PDF load error:', error)
    setIsLoading(false)
    setPdfError(`Failed to load PDF: ${error.message || 'Unknown error'}`)
  }

  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(numPages || 1, page))
    setPageNumber(clamped)
  }

  const zoomIn = () => setScale(prev => Math.min(prev + 0.2, 3))
  const zoomOut = () => setScale(prev => Math.max(prev - 0.2, 0.5))

  const deleteHighlight = async (id: number) => {
    if (!confirm('Delete this highlight?')) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('book_highlights')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setHighlights(highlights.filter(h => h.id !== id))
      toast.success('Highlight deleted')
    } catch (error) {
      console.error('Error deleting highlight:', error)
      toast.error('Failed to delete highlight')
    }
  }

  const deleteNote = async (id: number) => {
    if (!confirm('Delete this note?')) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('book_notes')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) throw error

      setNotes(notes.filter(n => n.id !== id))
      toast.success('Note deleted')
    } catch (error) {
      console.error('Error deleting note:', error)
      toast.error('Failed to delete note')
    }
  }

  const createNote = async () => {
    if (!newNoteContent.trim()) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from('book_notes')
        .insert({
          book_id: book.id,
          user_id: user.id,
          content: newNoteContent.trim(),
          page_number: pageNumber,
          position: {}
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setNotes([...notes, data])
        setNewNoteContent('')
        setShowNoteForm(false)
        toast.success('Note created')
      }
    } catch (error) {
      console.error('Error creating note:', error)
      toast.error('Failed to create note')
    }
  }

  const pageHighlights = highlights.filter(h => h.page_number === pageNumber)
  const pageNotes = notes.filter(n => n.page_number === pageNumber)

  return (
    <div className={`flex flex-col h-screen ${styles.background}`}>
      {/* Modern Header */}
      <div className={`border-b ${styles.sidebar} px-6 py-3`}>
        <div className="flex items-center justify-between">
          {/* Left Section */}
          <div className="flex items-center gap-4">
            <Link href={`/books/${book.id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <div className="h-6 w-px bg-gray-300" />
            <div>
              <h1 className={`text-lg font-semibold ${styles.text}`}>{book.title}</h1>
              {book.author && <p className={`text-sm ${styles.textMuted}`}>{book.author}</p>}
            </div>
          </div>

          {/* Center - Navigation */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToPage(pageNumber - 1)}
              disabled={pageNumber <= 1}
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2 px-3">
              <Input
                type="number"
                value={pageNumber}
                onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                className="w-16 h-9 text-center"
                min={1}
                max={numPages}
              />
              <span className={`text-sm ${styles.textMuted}`}>/ {numPages}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => goToPage(pageNumber + 1)}
              disabled={pageNumber >= numPages}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>

          {/* Right Section - Tools */}
          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <Button variant="ghost" size="icon" onClick={zoomOut}>
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className={`text-sm ${styles.textMuted} min-w-[3rem] text-center`}>
              {Math.round(scale * 100)}%
            </span>
            <Button variant="ghost" size="icon" onClick={zoomIn}>
              <ZoomIn className="w-4 h-4" />
            </Button>

            <div className="h-6 w-px bg-gray-300" />

            {/* Highlight Mode Toggle */}
            <Button
              variant={isHighlightMode ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setIsHighlightMode(!isHighlightMode)}
            >
              <Highlighter className="w-4 h-4 mr-2" />
              Highlight
            </Button>

            {/* Reading Mode */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon">
                  {readingMode === 'dark' ? <Moon className="w-4 h-4" /> :
                   readingMode === 'sepia' ? <Coffee className="w-4 h-4" /> :
                   <Sun className="w-4 h-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setReadingMode('light')}>
                  <Sun className="w-4 h-4 mr-2" />
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReadingMode('dark')}>
                  <Moon className="w-4 h-4 mr-2" />
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setReadingMode('sepia')}>
                  <Coffee className="w-4 h-4 mr-2" />
                  Sepia
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Toggle Right Sidebar */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            >
              <Layout className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Highlight Color Picker */}
        {isHighlightMode && (
          <div className="flex items-center gap-2 mt-3 pb-2">
            <span className={`text-sm ${styles.textMuted}`}>Color:</span>
            {HIGHLIGHT_COLORS.map(color => (
              <button
                key={color.value}
                onClick={() => setSelectedHighlightColor(color)}
                className={`w-6 h-6 rounded-full ${color.class} border-2 ${
                  selectedHighlightColor.value === color.value ? 'border-gray-900' : 'border-transparent'
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* PDF Viewer Area - 60% width when sidebar is open */}
        <div className={`${rightSidebarOpen ? 'w-[60%]' : 'flex-1'} overflow-auto ${styles.background}`}>
          <div className="flex justify-center p-8">
            {pdfError ? (
              <div className="text-center p-8">
                <BookOpen className="w-16 h-16 text-red-400 mx-auto mb-4" />
                <p className="text-red-600 font-medium">{pdfError}</p>
              </div>
            ) : (
              <div 
                ref={pageRef}
                className="shadow-2xl"
                style={{ filter: styles.filter }}
              >
                <Document
                  file={book.file_url || ''}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className="flex flex-col items-center justify-center p-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
                      <p className={styles.textMuted}>Loading PDF...</p>
                    </div>
                  }
                >
                  <Page
                    pageNumber={pageNumber}
                    scale={scale}
                    renderTextLayer={true}
                    renderAnnotationLayer={true}
                  />
                </Document>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Highlights & Notes - 40% width */}
        {rightSidebarOpen && (
          <div className={`w-[40%] border-l ${styles.sidebar} flex flex-col overflow-hidden`}>
            {/* Custom Tab Headers */}
            <div className="flex w-full justify-start gap-8 border-b border-gray-200 dark:border-gray-700 px-4">
              <button
                onClick={() => setActiveRightTab('guide')}
                className={`bg-transparent px-0 pb-3 pt-3 text-sm font-normal border-b-2 transition-colors ${
                  activeRightTab === 'guide'
                    ? 'border-blue-500 text-gray-900 font-medium'
                    : 'border-transparent text-gray-600'
                }`}
              >
                导读
              </button>
              <button
                onClick={() => setActiveRightTab('highlights')}
                className={`bg-transparent px-0 pb-3 pt-3 text-sm font-normal border-b-2 transition-colors ${
                  activeRightTab === 'highlights'
                    ? 'border-blue-500 text-gray-900 font-medium'
                    : 'border-transparent text-gray-600'
                }`}
              >
                标注
              </button>
              <button
                onClick={() => setActiveRightTab('notes')}
                className={`bg-transparent px-0 pb-3 pt-3 text-sm font-normal border-b-2 transition-colors ${
                  activeRightTab === 'notes'
                    ? 'border-blue-500 text-gray-900 font-medium'
                    : 'border-transparent text-gray-600'
                }`}
              >
                脑图
              </button>
              <button
                onClick={() => setActiveRightTab('outline')}
                className={`bg-transparent px-0 pb-3 pt-3 text-sm font-normal border-b-2 transition-colors ${
                  activeRightTab === 'outline'
                    ? 'border-blue-500 text-gray-900 font-medium'
                    : 'border-transparent text-gray-600'
                }`}
              >
                笔记
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">

              {/* Guide Tab - AI导读 */}
              {activeRightTab === 'guide' && (
                <div className="m-4 mt-2">
                  <div className="space-y-4">
                    {loadingAiData ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className={`text-sm ${styles.textMuted}`}>加载中...</p>
                      </div>
                    ) : (
                      <>
                        {/* AI Reading Guide */}
                        <div>
                          <h3 className={`text-sm font-semibold mb-3 ${styles.text} flex items-center`}>
                            <BookOpen className="w-4 h-4 mr-2" />
                            AI 导读
                          </h3>
                          {aiGuide ? (
                            <Card className={`${styles.card} border`}>
                              <CardContent className="p-4">
                                <div className={`text-sm ${styles.text} whitespace-pre-wrap leading-relaxed`}>
                                  {aiGuide}
                                </div>
                              </CardContent>
                            </Card>
                          ) : (
                            <Card className={`${styles.card} border`}>
                              <CardContent className="p-4">
                                <p className={`text-sm ${styles.textMuted} text-center`}>
                                  暂无AI导读内容
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        {/* AI Analyzed Outline */}
                        <div>
                          <h3 className={`text-sm font-semibold mb-3 ${styles.text} flex items-center`}>
                            <FileText className="w-4 h-4 mr-2" />
                            AI 分析大纲
                          </h3>
                          {aiOutline ? (
                            <div className="space-y-3">
                              {/* Chapters */}
                              {aiOutline.chapters && Array.isArray(aiOutline.chapters) && (
                                <div className="space-y-3">
                                  {aiOutline.chapters.map((chapter: any, chapterIndex: number) => (
                                    <Card key={chapterIndex} className={`${styles.card} border`}>
                                      <CardContent className="p-4">
                                        <h4 className={`text-sm font-semibold ${styles.text} mb-3 flex items-center`}>
                                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#d6e8dc] text-[#4a7c5a] text-xs font-bold mr-2">
                                            {chapterIndex + 1}
                                          </span>
                                          {chapter.title}
                                        </h4>
                                        
                                        {/* Sections */}
                                        {chapter.sections && Array.isArray(chapter.sections) && chapter.sections.length > 0 && (
                                          <div className="mb-3">
                                            <p className={`text-xs font-medium ${styles.textMuted} mb-2`}>📑 主要内容</p>
                                            <div className="space-y-1">
                                              {chapter.sections.map((section: string, sIndex: number) => (
                                                <div key={sIndex} className={`text-sm ${styles.text} pl-4 border-l-2 border-[#b2cebb80]`}>
                                                  • {section}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}

                                        {/* Key Points */}
                                        {chapter.key_points && Array.isArray(chapter.key_points) && chapter.key_points.length > 0 && (
                                          <div>
                                            <p className={`text-xs font-medium ${styles.textMuted} mb-2`}>💡 关键要点</p>
                                            <div className="space-y-1">
                                              {chapter.key_points.map((point: string, pIndex: number) => (
                                                <div key={pIndex} className={`text-xs ${styles.text} bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded`}>
                                                  ✓ {point}
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}

                              {/* Main Themes */}
                              {aiOutline.main_themes && Array.isArray(aiOutline.main_themes) && aiOutline.main_themes.length > 0 && (
                                <Card className={`${styles.card} border`}>
                                  <CardContent className="p-4">
                                    <h4 className={`text-sm font-semibold ${styles.text} mb-3`}>🎯 核心主题</h4>
                                    <div className="flex flex-wrap gap-2">
                                      {aiOutline.main_themes.map((theme: string, index: number) => (
                                        <Badge key={index} variant="outline" className="text-xs bg-[#d6e8dc66] dark:bg-[#32493a] border-[#b2cebb80]">
                                          {theme}
                                        </Badge>
                                      ))}
                                    </div>
                                  </CardContent>
                                </Card>
                              )}
                            </div>
                          ) : (
                            <Card className={`${styles.card} border`}>
                              <CardContent className="p-4">
                                <p className={`text-sm ${styles.textMuted} text-center`}>
                                  暂无AI分析大纲
                                </p>
                              </CardContent>
                            </Card>
                          )}
                        </div>

                        {/* Key Concepts */}
                        {aiOutline && aiOutline.key_concepts && (
                          <div>
                            <h3 className={`text-sm font-semibold mb-3 ${styles.text}`}>
                              核心概念
                            </h3>
                            <div className="flex flex-wrap gap-2">
                              {Array.isArray(aiOutline.key_concepts) ? (
                                aiOutline.key_concepts.map((concept: string, index: number) => (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {concept}
                                  </Badge>
                                ))
                              ) : (
                                <p className={`text-xs ${styles.textMuted}`}>无</p>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Highlights Tab */}
              {activeRightTab === 'highlights' && (
                <div className="m-4 mt-2">
                <div className="space-y-3">
                  {/* Current Page Highlights */}
                  {pageHighlights.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className="text-xs">Page {pageNumber}</Badge>
                        <span className={`text-xs ${styles.textMuted}`}>
                          {pageHighlights.length} highlight{pageHighlights.length > 1 ? 's' : ''}
                        </span>
                      </div>
                      {pageHighlights.map(highlight => (
                        <Card key={highlight.id} className={`${styles.card} border`}>
                          <CardContent className="p-3">
                            <div
                              className="border-l-4 pl-3 mb-2"
                              style={{ borderLeftColor: highlight.color }}
                            >
                              <p className={`text-sm ${styles.text} line-clamp-3`}>
                                {highlight.text}
                              </p>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className={`text-xs ${styles.textMuted}`}>
                                <Calendar className="w-3 h-3 inline mr-1" />
                                {new Date(highlight.created_at).toLocaleDateString()}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-destructive"
                                onClick={() => deleteHighlight(highlight.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}

                  {/* All Other Highlights */}
                  {highlights.filter(h => h.page_number !== pageNumber).length > 0 && (
                    <div>
                      <h3 className={`text-sm font-semibold mb-2 ${styles.text}`}>
                        Other Pages ({highlights.filter(h => h.page_number !== pageNumber).length})
                      </h3>
                      {highlights
                        .filter(h => h.page_number !== pageNumber)
                        .slice(0, 5)
                        .map(highlight => (
                          <Card key={highlight.id} className={`${styles.card} border mb-2`}>
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between mb-2">
                                <Badge variant="outline" className="text-xs">
                                  Page {highlight.page_number}
                                </Badge>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6"
                                  onClick={() => goToPage(highlight.page_number)}
                                >
                                  <BookOpen className="w-3 h-3" />
                                </Button>
                              </div>
                              <div
                                className="border-l-4 pl-3"
                                style={{ borderLeftColor: highlight.color }}
                              >
                                <p className={`text-sm ${styles.text} line-clamp-2`}>
                                  {highlight.text}
                                </p>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      {highlights.filter(h => h.page_number !== pageNumber).length > 5 && (
                        <Button variant="link" size="sm" asChild className="w-full">
                          <Link href={`/books/${book.id}/highlights`}>
                            View all {highlights.length} highlights
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}

                  {highlights.length === 0 && (
                    <div className="text-center py-8">
                      <Highlighter className={`w-12 h-12 mx-auto mb-3 ${styles.textMuted}`} />
                      <p className={`text-sm ${styles.textMuted}`}>
                        No highlights yet. Enable highlight mode to start.
                      </p>
                    </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mind Map Tab - 脑图 */}
              {activeRightTab === 'notes' && (
                <div className="flex flex-col h-full">
                  {loadingAiData ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className={`text-sm ${styles.textMuted}`}>加载思维导图中...</p>
                      </div>
                    </div>
                  ) : aiOutline ? (
                    <>
                      <div className="flex justify-end p-2 border-b flex-shrink-0">
                        <Button
                          onClick={() => generateMindMap(true)}
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                        >
                          <FileText className="w-3 h-3 mr-1" />
                          重新生成
                        </Button>
                      </div>
                      <div className="flex-1 min-h-0">
                        <BookMindMapAI 
                          bookTitle={book.title}
                          aiOutline={aiOutline}
                          aiGuide={aiGuide || undefined}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center py-8 px-4">
                        <BookMarked className={`w-12 h-12 mx-auto mb-3 ${styles.textMuted}`} />
                        <p className={`text-sm ${styles.textMuted} mb-3`}>
                          暂无思维导图数据
                        </p>
                        <Button
                          onClick={() => generateMindMap()}
                          variant="outline"
                          size="sm"
                          className="mt-2"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          生成思维导图
                        </Button>
                        <p className={`text-xs ${styles.textMuted} mt-3`}>
                          点击按钮自动生成思维导图
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Notes Tab - 笔记 */}
              {activeRightTab === 'outline' && (
                <div className="m-4 mt-2">
                  <div className="space-y-3">
                    {/* Add Note Button */}
                    {!showNoteForm && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowNoteForm(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        添加页面 {pageNumber} 笔记
                      </Button>
                    )}

                    {/* New Note Form */}
                    {showNoteForm && (
                      <Card className={`${styles.card} border`}>
                        <CardContent className="p-3 space-y-2">
                          <Textarea
                            placeholder="写下你的笔记..."
                            value={newNoteContent}
                            onChange={(e) => setNewNoteContent(e.target.value)}
                            className="min-h-[100px]"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={createNote}>
                              保存
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowNoteForm(false)
                                setNewNoteContent('')
                              }}
                            >
                              取消
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Current Page Notes */}
                    {pageNotes.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="secondary" className="text-xs">页面 {pageNumber}</Badge>
                          <span className={`text-xs ${styles.textMuted}`}>
                            {pageNotes.length} 条笔记
                          </span>
                        </div>
                        {pageNotes.map(note => (
                          <Card key={note.id} className={`${styles.card} border mb-2`}>
                            <CardContent className="p-3">
                              <p className={`text-sm ${styles.text} mb-2 whitespace-pre-wrap`}>
                                {note.content}
                              </p>
                              <div className="flex items-center justify-between">
                                <span className={`text-xs ${styles.textMuted}`}>
                                  <Calendar className="w-3 h-3 inline mr-1" />
                                  {new Date(note.created_at).toLocaleDateString('zh-CN')}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-destructive"
                                  onClick={() => deleteNote(note.id)}
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}

                    {/* All Other Notes */}
                    {notes.filter(n => n.page_number !== pageNumber).length > 0 && (
                      <div>
                        <h3 className={`text-sm font-semibold mb-2 ${styles.text}`}>
                          其他页面 ({notes.filter(n => n.page_number !== pageNumber).length})
                        </h3>
                        {notes
                          .filter(n => n.page_number !== pageNumber)
                          .slice(0, 5)
                          .map(note => (
                            <Card key={note.id} className={`${styles.card} border mb-2`}>
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-2">
                                  <Badge variant="outline" className="text-xs">
                                    页面 {note.page_number}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6"
                                    onClick={() => goToPage(note.page_number)}
                                  >
                                    <BookOpen className="w-3 h-3" />
                                  </Button>
                                </div>
                                <p className={`text-sm ${styles.text} line-clamp-3 whitespace-pre-wrap`}>
                                  {note.content}
                                </p>
                              </CardContent>
                            </Card>
                          ))}
                      </div>
                    )}

                    {notes.length === 0 && !showNoteForm && (
                      <div className="text-center py-8">
                        <StickyNote className={`w-12 h-12 mx-auto mb-3 ${styles.textMuted}`} />
                        <p className={`text-sm ${styles.textMuted} mb-4`}>
                          还没有笔记。开始添加你的想法吧！
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}



