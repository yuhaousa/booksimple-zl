'use client'

import { useState, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
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
  Edit3,
  Save,
  MoreVertical,
  Moon,
  Sun,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`
}

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#FBBF24', class: 'bg-yellow-300' },
  { name: 'Blue', value: '#3B82F6', class: 'bg-blue-300' },
  { name: 'Green', value: '#10B981', class: 'bg-green-300' },
  { name: 'Pink', value: '#EC4899', class: 'bg-pink-300' },
  { name: 'Purple', value: '#8B5CF6', class: 'bg-purple-300' },
]

// Reading mode utility functions
const getReadingModeStyles = (mode: 'light' | 'dark' | 'sepia') => {
  switch (mode) {
    case 'dark':
      return {
        background: 'bg-gray-900',
        containerBg: 'bg-gray-800',
        textColor: 'text-gray-100',
        filter: 'invert(1) hue-rotate(180deg)'
      }
    case 'sepia':
      return {
        background: 'bg-amber-50',
        containerBg: 'bg-amber-100',
        textColor: 'text-amber-900',
        filter: 'sepia(1) saturate(0.8) brightness(1.1)'
      }
    default: // light
      return {
        background: 'bg-white',
        containerBg: 'bg-gray-50',
        textColor: 'text-gray-900',
        filter: 'none'
      }
  }
}

interface Book {
  id: number
  title: string
  author: string | null
  publisher: string | null
  year: number | null
  description: string | null
  tags: string | null
  cover_url: string | null
  file_url: string | null
  user_id: string
}

interface Outline {
  title: string
  page: number
  items?: Outline[]
  isCustom?: boolean
  id?: string
  originalIndex?: number
}

interface CustomOutlineItem {
  id: string
  book_id: number
  title: string
  page_number: number
  parent_id?: string
  sort_order: number
  original_pdf_index?: number
  user_id: string
  created_at: string
  updated_at: string
}

interface Highlight {
  id: string
  bookId: number
  page: number
  text: string
  color: string
  position: {
    x: number
    y: number
    width: number
    height: number
  }
  rects?: Array<{
    x: number
    y: number
    width: number
    height: number
  }>
  createdAt: string
}

interface Note {
  id: string
  bookId: number
  page: number
  content: string
  position: {
    x: number
    y: number
  }
  createdAt: string
  updatedAt: string
}

interface BookReaderProps {
  book: Book
}

export function BookReader({ book }: BookReaderProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.2)
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Sidebar and navigation
  const [outline, setOutline] = useState<Outline[]>([])
  const [customOutlines, setCustomOutlines] = useState<CustomOutlineItem[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'outline' | 'highlights' | 'notes'>('outline')
  
  // Highlights and Notes
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedHighlightColor, setSelectedHighlightColor] = useState(HIGHLIGHT_COLORS[0])
  const [isHighlightMode, setIsHighlightMode] = useState(false)
  const [isNoteMode, setIsNoteMode] = useState(false)
  
  // Reading mode settings
  const [readingMode, setReadingMode] = useState<'light' | 'dark' | 'sepia'>('light')
  
  // Outline editing
  const [isEditingOutline, setIsEditingOutline] = useState(false)
  const [newOutlineTitle, setNewOutlineTitle] = useState('')
  const [newOutlinePage, setNewOutlinePage] = useState(1)
  const [editingOutlineId, setEditingOutlineId] = useState<string | null>(null)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [newNoteContent, setNewNoteContent] = useState('')
  
  // Note creation state
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [selectedText, setSelectedText] = useState('')
  const [selectedPosition, setSelectedPosition] = useState<{ x: number; y: number } | null>(null)
  
  // Refs
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadBookData()
  }, [book.id])

  // Load reading mode preference on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('pdf-reader-mode') as 'light' | 'dark' | 'sepia'
    if (savedMode && ['light', 'dark', 'sepia'].includes(savedMode)) {
      setReadingMode(savedMode)
    }
  }, [])
  
  // Save reading mode preference when changed
  useEffect(() => {
    localStorage.setItem('pdf-reader-mode', readingMode)
  }, [readingMode])

  const loadBookData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Load highlights
      const { data: highlightsData } = await supabase
        .from('book_highlights')
        .select('*')
        .eq('book_id', book.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (highlightsData) {
        setHighlights(highlightsData.map(h => ({
          id: h.id,
          bookId: h.book_id,
          page: h.page_number,
          text: h.text,
          color: h.color,
          position: h.position,
          rects: h.position?.rects || [h.position],
          createdAt: h.created_at
        })))
      }

      // Load notes
      const { data: notesData } = await supabase
        .from('book_notes')
        .select('*')
        .eq('book_id', book.id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (notesData) {
        setNotes(notesData.map(n => ({
          id: n.id,
          bookId: n.book_id,
          page: n.page_number,
          content: n.content,
          position: n.position,
          createdAt: n.created_at,
          updatedAt: n.updated_at
        })))
      }

      // Load custom outlines
      const { data: customOutlineData } = await supabase
        .from('custom_outline')
        .select('*')
        .eq('book_id', book.id)
        .eq('user_id', user.id)
        .order('sort_order', { ascending: true })

      if (customOutlineData) {
        setCustomOutlines(customOutlineData)
      }
    } catch (error) {
      console.error('Error loading book data:', error)
    }
  }

  const onDocumentLoadSuccess = async ({ numPages }: { numPages: number }) => {
    console.log('PDF loaded successfully, pages:', numPages)
    setNumPages(numPages)
    setIsLoading(false)
    setPdfError(null)
    
    // Try to extract PDF outline
    try {
      const pdf = arguments[0]
      const outline = await pdf.getOutline()
      
      if (outline && outline.length > 0) {
        const processOutline = async (items: any[]): Promise<Outline[]> => {
          const processedItems: Outline[] = []
          
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            let pageNumber = 1
            
            try {
              if (item.dest) {
                let destination = item.dest
                
                if (typeof item.dest === 'string') {
                  destination = await pdf.getDestination(item.dest)
                }
                
                if (destination && destination.length > 0 && destination[0]) {
                  const pageRef = destination[0]
                  
                  if (typeof pageRef === 'object' && pageRef.num) {
                    const pageIndex = await pdf.getPageIndex(pageRef)
                    pageNumber = pageIndex + 1
                  } else if (typeof pageRef === 'number') {
                    pageNumber = pageRef + 1
                  }
                }
              }
              
              if (pageNumber === 1 && item.page) {
                pageNumber = typeof item.page === 'number' ? item.page : parseInt(item.page) || 1
              }
              
              if (pageNumber === 1 && i > 0) {
                pageNumber = i + 1
              }
            } catch (error) {
              console.warn('Error processing outline item:', error)
              pageNumber = i + 1
            }
            
            const processedItem: Outline = {
              title: item.title || 'Untitled',
              page: pageNumber,
              items: item.items ? await processOutline(item.items) : undefined,
              originalIndex: i
            }
            
            processedItems.push(processedItem)
          }
          
          return processedItems
        }
        
        const processedOutline = await processOutline(outline)
        setOutline(processedOutline)
      } else {
        setOutline([])
      }
    } catch (error) {
      console.error('Error extracting outline:', error)
      setOutline([])
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

  // Helper functions for outlines, notes, highlights
  const addCustomOutlineItem = async () => {
    if (!newOutlineTitle.trim() || newOutlinePage < 1 || newOutlinePage > numPages) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const maxOrder = Math.max(...customOutlines.map(o => o.sort_order), -1)

      const { data, error } = await supabase
        .from('custom_outline')
        .insert({
          book_id: book.id,
          title: newOutlineTitle.trim(),
          page_number: newOutlinePage,
          sort_order: maxOrder + 1,
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setCustomOutlines(prev => [...prev, data])
        setNewOutlineTitle('')
        setNewOutlinePage(1)
        setIsEditingOutline(false)
      }
    } catch (error) {
      console.error('Error adding custom outline item:', error)
    }
  }

  const deleteCustomOutlineItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_outline')
        .delete()
        .eq('id', id)

      if (error) throw error

      setCustomOutlines(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error('Error deleting custom outline item:', error)
    }
  }

  // Note functions
  const createNote = async () => {
    if (!newNoteContent.trim() || !selectedPosition) return

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let content = newNoteContent.trim()
      
      // If there's selected text, add it as a quote at the beginning
      if (selectedText.trim()) {
        content = `"${selectedText.trim()}"\n\n${content}`
      }

      const { data, error } = await supabase
        .from('book_notes')
        .insert({
          book_id: book.id,
          page_number: pageNumber,
          content,
          position: selectedPosition,
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      const newNote: Note = {
        id: data.id,
        bookId: book.id,
        page: pageNumber,
        content,
        position: selectedPosition,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }

      setNotes(prev => [newNote, ...prev])
      setNewNoteContent('')
      setSelectedText('')
      setSelectedPosition(null)
      setShowNoteForm(false)
    } catch (error) {
      console.error('Error creating note:', error)
    }
  }

  const updateNote = async (noteId: string, content: string) => {
    try {
      const { error } = await supabase
        .from('book_notes')
        .update({ 
          content,
          updated_at: new Date().toISOString()
        })
        .eq('id', noteId)

      if (error) throw error

      setNotes(prev => prev.map(note => 
        note.id === noteId 
          ? { ...note, content, updatedAt: new Date().toISOString() }
          : note
      ))

      setEditingNote(null)
      setNewNoteContent('')
    } catch (error) {
      console.error('Error updating note:', error)
    }
  }

  const deleteNote = async (noteId: string) => {
    try {
      const { error } = await supabase
        .from('book_notes')
        .delete()
        .eq('id', noteId)

      if (error) throw error

      setNotes(prev => prev.filter(note => note.id !== noteId))
    } catch (error) {
      console.error('Error deleting note:', error)
    }
  }

  const deleteHighlight = async (highlightId: string) => {
    try {
      const { error } = await supabase
        .from('book_highlights')
        .delete()
        .eq('id', highlightId)

      if (error) throw error

      setHighlights(prev => prev.filter(highlight => highlight.id !== highlightId))
    } catch (error) {
      console.error('Error deleting highlight:', error)
    }
  }

  const getMergedOutline = () => {
    const pdfOutlineWithIndex = outline.map((item, index) => ({
      ...item,
      isCustom: false,
      originalIndex: index
    }))

    const overrides = new Set()
    const mergedItems: Outline[] = []

    customOutlines.forEach(customItem => {
      if (customItem.original_pdf_index !== null && customItem.original_pdf_index !== undefined) {
        overrides.add(customItem.original_pdf_index)
        mergedItems.push({
          title: customItem.title,
          page: customItem.page_number,
          isCustom: true,
          id: customItem.id,
          originalIndex: customItem.original_pdf_index
        })
      } else {
        mergedItems.push({
          title: customItem.title,
          page: customItem.page_number,
          isCustom: true,
          id: customItem.id
        })
      }
    })

    pdfOutlineWithIndex.forEach(pdfItem => {
      if (!overrides.has(pdfItem.originalIndex)) {
        mergedItems.push(pdfItem)
      }
    })

    return mergedItems.sort((a, b) => a.page - b.page)
  }

  const handleTextSelection = async () => {
    try {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) return
      
      const selectedText = selection.toString().trim()
      if (!selectedText) return

      if (isHighlightMode) {
        // Handle highlighting
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const highlight: Omit<Highlight, 'id' | 'createdAt'> = {
          bookId: book.id,
          page: pageNumber,
          text: selectedText,
          color: selectedHighlightColor.value,
          position: { x: 0, y: 0, width: 1, height: 0.1 }
        }

        const { data, error } = await supabase
          .from('book_highlights')
          .insert({
            book_id: highlight.bookId,
            page_number: highlight.page,
            text: highlight.text,
            color: highlight.color,
            position: highlight.position,
            user_id: user.id
          })
          .select()
          .single()

        if (error) throw error

        setHighlights(prev => [{
          ...highlight,
          id: data.id,
          createdAt: data.created_at
        }, ...prev])
      } else if (isNoteMode) {
        // Handle note creation
        const range = selection.getRangeAt(0)
        const rect = range.getBoundingClientRect()
        
        const position = {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }

        setSelectedText(selectedText)
        setSelectedPosition(position)
        setShowNoteForm(true)
        setActiveTab('notes')
      }

      selection.removeAllRanges()
    } catch (error) {
      console.error('Error handling text selection:', error)
    }
  }

  const currentPageHighlights = highlights.filter(h => h.page === pageNumber)
  const currentPageNotes = notes.filter(n => n.page === pageNumber)
  const readingModeStyles = getReadingModeStyles(readingMode)

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen bg-background relative">
        {/* Sidebar */}
        <div className={`${sidebarOpen ? 'w-96' : 'w-0'} transition-all duration-300 border-r border-border bg-card overflow-hidden`}>
          <div className="h-full flex flex-col p-2">
            {/* Sidebar Header */}
            <div className="p-4 border-b border-border mx-2 mb-2 rounded-lg bg-background/50">
              <div className="flex items-center justify-between mb-4">
                <Link href={`/books/${book.id}`}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSidebarOpen(false)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <h2 className="text-lg font-bold text-foreground line-clamp-2 mb-2">
                {book.title}
              </h2>
              {book.author && (
                <p className="text-sm text-muted-foreground mb-4">by {book.author}</p>
              )}

              {/* Tab Navigation */}
              <div className="flex rounded-lg bg-muted p-1 mb-4">
                <button
                  onClick={() => setActiveTab('outline')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'outline' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <BookOpen className="w-4 h-4 inline mr-1" />
                  Outline
                </button>
                <button
                  onClick={() => setActiveTab('highlights')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'highlights' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Highlighter className="w-4 h-4 inline mr-1" />
                  Highlights
                </button>
                <button
                  onClick={() => setActiveTab('notes')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'notes' 
                      ? 'bg-background text-foreground shadow-sm' 
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <StickyNote className="w-4 h-4 inline mr-1" />
                  Notes
                </button>
              </div>
            </div>

            {/* Sidebar Content */}
            <ScrollArea className="flex-1 mx-2">
              <div className="p-4 space-y-4">
                {activeTab === 'outline' && (
                  <div className="space-y-4">
                    {/* Add Bookmark Section */}
                    <div className="bg-muted/30 p-4 rounded-lg border border-border/50">
                      <div className="mb-2">
                        <h3 className="text-sm font-medium mb-2">Bookmarks & Outline</h3>
                        <button
                          onClick={() => {
                            setIsEditingOutline(!isEditingOutline)
                            setNewOutlineTitle('')
                            setNewOutlinePage(pageNumber)
                          }}
                          className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                        >
                          {isEditingOutline ? 'Cancel' : 'Add Bookmark'}
                        </button>
                      </div>
                      
                      {isEditingOutline && (
                        <div className="space-y-2 p-2 bg-muted/50 rounded">
                          <input
                            type="text"
                            value={newOutlineTitle}
                            onChange={(e) => setNewOutlineTitle(e.target.value)}
                            placeholder="Bookmark title"
                            className="w-full px-2 py-1 text-sm border rounded"
                          />
                          <div className="flex items-center gap-2">
                            <label className="text-xs">Page:</label>
                            <input
                              type="number"
                              value={newOutlinePage}
                              onChange={(e) => setNewOutlinePage(parseInt(e.target.value) || 1)}
                              min="1"
                              max={numPages}
                              className="w-20 px-2 py-1 text-sm border rounded"
                            />
                            <button
                              onClick={addCustomOutlineItem}
                              disabled={!newOutlineTitle.trim()}
                              className="px-3 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Outline Items */}
                    <div className="mt-4">
                      {getMergedOutline().length > 0 ? (
                        <div className="space-y-1 bg-background/50 p-3 rounded-md border border-border/30 max-h-96 overflow-y-auto">
                          {getMergedOutline().map((item, index) => (
                            <div key={`${item.isCustom ? 'custom' : 'pdf'}-${item.id || index}-${item.page}`} className="grid grid-cols-[1fr_24px] gap-1 w-full items-center">
                              <button
                                type="button"
                                onClick={() => goToPage(item.page)}
                                className="text-left p-2 rounded-md hover:bg-muted transition-colors text-sm flex items-center justify-between bg-card border border-border/50 hover:border-border min-w-0"
                                title={`Go to page ${item.page}${item.isCustom ? ' (Custom bookmark)' : ' (PDF outline)'}`}
                              >
                                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                  <span className="text-xs opacity-60 flex-shrink-0 w-4">
                                    {item.isCustom ? '★' : '📄'}
                                  </span>
                                  <span className="truncate text-xs leading-relaxed font-medium" title={item.title}>
                                    {item.title}
                                  </span>
                                </div>
                                <span className="text-xs text-muted-foreground ml-2 flex-shrink-0 font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                                  {item.page}
                                </span>
                              </button>
                              
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                  >
                                    <MoreVertical className="h-3 w-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent side="right" align="start" className="w-48">
                                  {item.isCustom && item.id && (
                                    <DropdownMenuItem
                                      onClick={() => deleteCustomOutlineItem(item.id!)}
                                      className="text-sm text-red-600 focus:text-red-600"
                                    >
                                      <Trash2 className="mr-2 h-3 w-3" />
                                      Delete bookmark
                                    </DropdownMenuItem>
                                  )}
                                  {!item.isCustom && (
                                    <DropdownMenuItem disabled className="text-sm text-muted-foreground">
                                      PDF outline item
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground py-8">
                          <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No bookmarks available</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'highlights' && (
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-3">
                    {highlights.map((highlight) => (
                      <div key={highlight.id} className="p-3 border border-border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            Page {highlight.page}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteHighlight(highlight.id)}
                            className="h-6 w-6 p-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                        <div 
                          className="p-2 rounded text-sm cursor-pointer"
                          style={{ backgroundColor: highlight.color + '40' }}
                          onClick={() => goToPage(highlight.page)}
                        >
                          {highlight.text}
                        </div>
                      </div>
                    ))}
                    {highlights.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        <Highlighter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No highlights yet</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'notes' && (
                  <div className="bg-muted/30 p-4 rounded-lg border border-border/50 space-y-3">
                    {showNoteForm && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                        <h4 className="font-medium text-sm">Add Note</h4>
                        {selectedText && (
                          <div className="text-xs bg-gray-100 p-2 rounded border-l-4 border-blue-400">
                            <strong>Selected text:</strong> "{selectedText}"
                          </div>
                        )}
                        <Textarea
                          value={newNoteContent}
                          onChange={(e) => setNewNoteContent(e.target.value)}
                          placeholder="Enter your note..."
                          className="min-h-[80px] text-sm"
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={createNote}
                            disabled={!newNoteContent.trim()}
                          >
                            Save Note
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setShowNoteForm(false)
                              setNewNoteContent('')
                              setSelectedText('')
                              setSelectedPosition(null)
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}

                    {notes.map((note, index) => (
                      <div key={note.id} className="p-3 border border-border rounded-lg">
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            Note {index + 1} (Page {note.page})
                          </span>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingNote(note.id)
                                setNewNoteContent(note.content)
                              }}
                              className="h-6 w-6 p-0"
                            >
                              <Edit3 className="w-3 h-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => deleteNote(note.id)}
                              className="h-6 w-6 p-0"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                        {editingNote === note.id ? (
                          <div className="space-y-2">
                            <Textarea
                              value={newNoteContent}
                              onChange={(e) => setNewNoteContent(e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => updateNote(note.id, newNoteContent)}
                              >
                                <Save className="w-3 h-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditingNote(null)
                                  setNewNoteContent('')
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            {note.content.includes('"') && note.content.includes('\n\n') && (
                              <div className="text-xs italic text-muted-foreground mb-2 border-l-2 border-gray-300 pl-2">
                                {note.content.split('\n\n')[0].replace(/"/g, '')}
                              </div>
                            )}
                            <p 
                              className="text-sm cursor-pointer hover:bg-muted p-2 rounded"
                              onClick={() => goToPage(note.page)}
                            >
                              {(() => {
                                const content = note.content.includes('\n\n')
                                  ? note.content.split('\n\n')[1] || note.content
                                  : note.content
                                return content
                              })()}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                    {notes.length === 0 && (
                      <div className="text-center text-muted-foreground py-8">
                        <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No notes yet</p>
                        <p className="text-xs mt-2">Select text and enable note mode to add notes</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Toolbar */}
          <div className="bg-card border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {!sidebarOpen && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu className="w-4 h-4" />
                  </Button>
                )}
                
                {/* Page Navigation */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pageNumber - 1)}
                  disabled={pageNumber <= 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={pageNumber}
                    onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
                    className="w-16 h-8 text-center"
                    min={1}
                    max={numPages}
                  />
                  <span className="text-sm text-muted-foreground">
                    of {numPages}
                  </span>
                </div>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => goToPage(pageNumber + 1)}
                  disabled={pageNumber >= numPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {/* Highlight Mode */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={isHighlightMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsHighlightMode(!isHighlightMode)}
                  >
                    <Highlighter className="w-4 h-4" />
                  </Button>
                  {isHighlightMode && (
                    <>
                      <div className="flex gap-1">
                        {HIGHLIGHT_COLORS.map((color) => (
                          <button
                            key={color.value}
                            onClick={() => setSelectedHighlightColor(color)}
                            className={`w-6 h-6 rounded border-2 ${color.class} ${
                              selectedHighlightColor.value === color.value 
                                ? 'border-foreground' 
                                : 'border-border'
                            }`}
                            title={color.name}
                          />
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                        Select text to highlight
                      </div>
                    </>
                  )}
                </div>

                {/* Note Mode */}
                <div className="flex items-center gap-1">
                  <Button
                    variant={isNoteMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsNoteMode(!isNoteMode)}
                  >
                    <StickyNote className="w-4 h-4" />
                  </Button>
                  {isNoteMode && (
                    <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded-md">
                      Select text to add note
                    </div>
                  )}
                </div>

                {/* Zoom Controls */}
                <Button variant="outline" size="sm" onClick={zoomOut}>
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground min-w-[4rem] text-center">
                  {Math.round(scale * 100)}%
                </span>
                <Button variant="outline" size="sm" onClick={zoomIn}>
                  <ZoomIn className="w-4 h-4" />
                </Button>

                {/* Reading Mode Controls */}
                <div className="flex items-center gap-1 px-2 border-l border-border">
                  <span className="text-xs text-muted-foreground mr-2">Reading Mode:</span>
                  <Button 
                    variant={readingMode === 'light' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setReadingMode('light')}
                    title="Light mode"
                  >
                    <Sun className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant={readingMode === 'sepia' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setReadingMode('sepia')}
                    title="Sepia mode"
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant={readingMode === 'dark' ? 'default' : 'outline'} 
                    size="sm" 
                    onClick={() => setReadingMode('dark')}
                    title="Dark mode"
                  >
                    <Moon className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* PDF Viewer */}
          <div className={`flex-1 overflow-auto ${readingModeStyles.background}`}>
            <div className="flex justify-center">
              <div className="w-full relative">
                <div 
                  ref={pageRef}
                  className={`pdf-viewer-container relative ${readingModeStyles.containerBg} transition-all duration-300`}
                  style={{ filter: readingModeStyles.filter }}
                  onMouseUp={handleTextSelection}
                >
                  {pdfError ? (
                    <div className={`flex items-center justify-center p-8 ${readingModeStyles.containerBg} min-h-screen`}>
                      <div className="text-center">
                        <p className={`text-red-500 mb-4 ${readingModeStyles.textColor}`}>Failed to load PDF file</p>
                        <p className={`text-sm text-muted-foreground mb-4 ${readingModeStyles.textColor}`}>{pdfError}</p>
                        <Button onClick={() => window.location.reload()}>
                          Retry Loading
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Document
                      file={book.file_url || ''}
                      onLoadSuccess={onDocumentLoadSuccess}
                      onLoadError={onDocumentLoadError}
                      loading={
                        <div className={`flex items-center justify-center p-8 ${readingModeStyles.containerBg} min-h-[600px]`}>
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                            <p className={`text-muted-foreground ${readingModeStyles.textColor}`}>Loading PDF...</p>
                          </div>
                        </div>
                      }
                    >
                      <div className="flex items-center justify-center min-h-screen relative">
                        <Page
                          pageNumber={pageNumber}
                          scale={scale}
                          renderTextLayer={true}
                          renderAnnotationLayer={false}
                        />
                        
                        {/* Simple Note Overlays */}
                        {currentPageNotes.map((note) => (
                          <div
                            key={note.id}
                            className="absolute bg-yellow-200 border border-yellow-400 rounded-md p-2 max-w-xs shadow-lg z-10 text-xs"
                            style={{
                              left: `${note.position.x + 50}px`,
                              top: `${note.position.y + 100}px`,
                            }}
                          >
                            <div className="font-medium mb-1">Note:</div>
                            <div className="text-gray-700">
                              {note.content.includes('\n\n') 
                                ? note.content.split('\n\n')[1] || note.content
                                : note.content
                              }
                            </div>
                          </div>
                        ))}
                      </div>
                    </Document>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
