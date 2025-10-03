'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

// Import react-pdf CSS styles with proper module imports
import 'react-pdf/dist/Page/TextLayer.css'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import '@/styles/react-pdf.css'

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
  Search,
  Menu,
  X,
  Plus,
  Trash2,
  Edit3,
  Save,
  Moon,
  Sun,
  Eye,
  MoreVertical
} from 'lucide-react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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

// Set up PDF.js worker
if (typeof window !== 'undefined') {
  // Use the local worker file
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.js';
}

// Static PDF options to prevent unnecessary reloads
const PDF_OPTIONS = {
  cMapUrl: `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/cmaps/`,
  cMapPacked: true,
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
  originalIndex?: number // For PDF outline items that can be overridden
}

interface CustomOutlineItem {
  id: string
  book_id: number
  title: string
  page_number: number
  parent_id?: string
  sort_order: number
  original_pdf_index?: number // Links to original PDF outline item if this is an override
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

const HIGHLIGHT_COLORS = [
  { name: 'Yellow', value: '#FBBF24', class: 'bg-yellow-300' },
  { name: 'Blue', value: '#3B82F6', class: 'bg-blue-300' },
  { name: 'Green', value: '#10B981', class: 'bg-green-300' },
  { name: 'Pink', value: '#EC4899', class: 'bg-pink-300' },
  { name: 'Purple', value: '#8B5CF6', class: 'bg-purple-300' },
]

export function BookReader({ book }: BookReaderProps) {
  // Add hydration state to prevent SSR/client mismatches
  const [isHydrated, setIsHydrated] = useState(false)
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(1)
  const [scale, setScale] = useState<number>(1.2)
  const [highlightUpdateTrigger, setHighlightUpdateTrigger] = useState(0)
  const [scrollUpdateTrigger, setScrollUpdateTrigger] = useState(0)
  const [outline, setOutline] = useState<Outline[]>([])
  const [customOutlines, setCustomOutlines] = useState<CustomOutlineItem[]>([])
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [activeTab, setActiveTab] = useState<'outline' | 'highlights' | 'notes'>('outline')
  const [pdfError, setPdfError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Outline editing
  const [isEditingOutline, setIsEditingOutline] = useState(false)
  const [newOutlineTitle, setNewOutlineTitle] = useState('')
  const [newOutlinePage, setNewOutlinePage] = useState(1)
  const [editingOutlineId, setEditingOutlineId] = useState<string | null>(null)
  
  // Reading mode settings
  const [readingMode, setReadingMode] = useState<'light' | 'dark' | 'sepia'>('light')
  
  // Handle client-side hydration
  useEffect(() => {
    setIsHydrated(true)
  }, [])
  
  // Load reading mode preference on mount (only after hydration)
  useEffect(() => {
    if (!isHydrated) return
    
    const savedMode = localStorage.getItem('pdf-reader-mode') as 'light' | 'dark' | 'sepia'
    if (savedMode && ['light', 'dark', 'sepia'].includes(savedMode)) {
      setReadingMode(savedMode)
    }
  }, [isHydrated])
  
  // Save reading mode preference when changed
  useEffect(() => {
    localStorage.setItem('pdf-reader-mode', readingMode)
  }, [readingMode])
  
  // Highlights and Notes
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedHighlightColor, setSelectedHighlightColor] = useState(HIGHLIGHT_COLORS[0])
  const [isHighlightMode, setIsHighlightMode] = useState(false)
  const [isNoteMode, setIsNoteMode] = useState(false)
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [newNoteContent, setNewNoteContent] = useState('')
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ page: number, text: string }[]>([])
  
  // Refs
  const pageRef = useRef<HTMLDivElement>(null)
  const documentRef = useRef<any>(null)

  useEffect(() => {
    if (!isHydrated) return
    loadBookData()
  }, [book.id, isHydrated])

  // Force highlight re-positioning when scale or page changes (only after hydration)
  useEffect(() => {
    if (!isHydrated) return
    
    console.log('Scale or page changed:', { scale, pageNumber, currentTrigger: highlightUpdateTrigger })
    const timer = setTimeout(() => {
      setHighlightUpdateTrigger(prev => {
        const newTrigger = prev + 1
        console.log('Updating highlight trigger:', prev, '->', newTrigger)
        return newTrigger
      })
    }, 100) // Small delay to ensure PDF has rendered at new scale
    
    return () => clearTimeout(timer)
  }, [scale, pageNumber, isHydrated])

  // Add scroll event listener to update note positions during scrolling (only after hydration)
  useEffect(() => {
    if (!isHydrated) return
    
    let rafId: number | null = null
    let isScrolling = false

    const handleScroll = () => {
      if (!isScrolling) {
        isScrolling = true
        rafId = requestAnimationFrame(() => {
          setScrollUpdateTrigger(prev => prev + 1)
          isScrolling = false
        })
      }
    }

    // Listen to scroll events on window and document
    const scrollElements: (Window | Document | HTMLElement)[] = [window, document]
    
    // Also listen to any scrollable parent containers
    if (pageRef.current) {
      let parent = pageRef.current.parentElement
      while (parent && parent !== document.body) {
        const computedStyle = window.getComputedStyle(parent)
        if (computedStyle.overflow === 'auto' || computedStyle.overflow === 'scroll' || 
            computedStyle.overflowY === 'auto' || computedStyle.overflowY === 'scroll') {
          scrollElements.push(parent)
        }
        parent = parent.parentElement
      }
    }

    scrollElements.forEach(element => {
      element?.addEventListener('scroll', handleScroll, { passive: true })
    })

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      scrollElements.forEach(element => {
        element?.removeEventListener('scroll', handleScroll)
      })
    }
  }, [pageNumber, isHydrated]) // Re-setup when page changes or after hydration

  const loadBookData = async () => {
    try {
      // Get current user
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
          position: {
            x: h.position.x,
            y: h.position.y,
            width: h.position.width,
            height: h.position.height
          },
          rects: h.position.rects || [{
            x: h.position.x,
            y: h.position.y,
            width: h.position.width,
            height: h.position.height
          }],
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

  // Custom outline management functions
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

  const updateCustomOutlineItem = async (id: string, title: string, pageNumber: number) => {
    try {
      const { error } = await supabase
        .from('custom_outline')
        .update({
          title: title.trim(),
          page_number: pageNumber,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)

      if (error) throw error

      setCustomOutlines(prev =>
        prev.map(item =>
          item.id === id
            ? { ...item, title: title.trim(), page_number: pageNumber }
            : item
        )
      )
      setEditingOutlineId(null)
    } catch (error) {
      console.error('Error updating custom outline item:', error)
    }
  }

  const deleteCustomOutlineItem = async (id: string) => {
    try {
      const { error } = await supabase
        .from('custom_outline')
        .delete()
        .eq('id', id)

      if (error) throw error

      // Clear editing state if we're deleting the item being edited
      if (editingOutlineId === id) {
        setEditingOutlineId(null)
      }

      setCustomOutlines(prev => prev.filter(item => item.id !== id))
    } catch (error) {
      console.error('Error deleting custom outline item:', error)
    }
  }

  const createPdfOverride = async (originalIndex: number, title: string, pageNumber: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const maxOrder = Math.max(...customOutlines.map(o => o.sort_order), -1)

      const { data, error } = await supabase
        .from('custom_outline')
        .insert({
          book_id: book.id,
          title: title.trim(),
          page_number: pageNumber,
          sort_order: maxOrder + 1,
          original_pdf_index: originalIndex,
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      if (data) {
        setCustomOutlines(prev => [...prev, data])
        setEditingOutlineId(null)
      }
    } catch (error) {
      console.error('Error creating PDF outline override:', error)
    }
  }

  const convertPdfToCustom = async (pdfItem: Outline) => {
    if (pdfItem.originalIndex === undefined) return
    
    await createPdfOverride(pdfItem.originalIndex, pdfItem.title, pdfItem.page)
    setEditingOutlineId(`pdf-${pdfItem.originalIndex}`)
  }

  // Merge PDF outline with custom outlines, handling overrides
  const getMergedOutline = useMemo((): Outline[] => {
    // Create a map of PDF outline items with their index
    const pdfOutlineWithIndex: Outline[] = outline.map((item, index) => ({
      ...item,
      isCustom: false,
      originalIndex: index
    }))

    // Find overrides and regular custom items
    const overrides = new Set()
    const mergedItems: Outline[] = []

    // Process custom outlines
    customOutlines.forEach(customItem => {
      if (customItem.original_pdf_index !== null && customItem.original_pdf_index !== undefined) {
        // This is an override of a PDF outline item
        overrides.add(customItem.original_pdf_index)
        mergedItems.push({
          title: customItem.title,
          page: customItem.page_number,
          isCustom: true,
          id: customItem.id,
          originalIndex: customItem.original_pdf_index
        })
      } else {
        // This is a regular custom bookmark
        mergedItems.push({
          title: customItem.title,
          page: customItem.page_number,
          isCustom: true,
          id: customItem.id
        })
      }
    })

    // Add PDF outline items that haven't been overridden
    pdfOutlineWithIndex.forEach(pdfItem => {
      if (!overrides.has(pdfItem.originalIndex)) {
        mergedItems.push(pdfItem)
      }
    })

    // Sort by page number
    return mergedItems.sort((a, b) => a.page - b.page)
  }, [outline, customOutlines])

  // Navigation helper defined before outline renderers to avoid TDZ issues
  const goToPage = useCallback((page: number) => {
    const clamped = Math.max(1, Math.min(numPages || 1, page))
    console.log('goToPage called with page:', page, 'clamped:', clamped, 'numPages:', numPages)
    setPageNumber(clamped)
  }, [numPages])

  // Outline item component with navigation functionality and dropdown menu
  const EditableOutlineItem = ({ item, level = 0, onGo }: { item: Outline; level?: number; onGo: (page: number) => void }) => {
    const [editTitle, setEditTitle] = useState(item.title)
    const [editPage, setEditPage] = useState(item.page)
    const isEditing = editingOutlineId === item.id || editingOutlineId === `pdf-${item.originalIndex}`
    const isPdfItem = !item.isCustom && item.originalIndex !== undefined

    const handleSave = () => {
      if (item.isCustom && item.id) {
        updateCustomOutlineItem(item.id, editTitle, editPage)
      } else if (isPdfItem) {
        createPdfOverride(item.originalIndex!, editTitle, editPage)
      }
    }

    const handleEdit = () => {
      if (isPdfItem) {
        setEditingOutlineId(`pdf-${item.originalIndex}`)
      } else if (item.id) {
        setEditingOutlineId(item.id)
      }
    }

    const handleDelete = () => {
      if (item.isCustom && item.id) {
        deleteCustomOutlineItem(item.id)
      }
    }

    return (
      <div className="space-y-1">
        {isEditing ? (
          <div className="p-2 border rounded bg-muted/50 space-y-2">
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-2 py-1 text-sm border rounded"
              placeholder="Outline title"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={editPage}
                onChange={(e) => setEditPage(parseInt(e.target.value) || 1)}
                min="1"
                max={numPages}
                className="w-20 px-2 py-1 text-sm border rounded"
              />
              <button
                onClick={handleSave}
                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
              >
                {isPdfItem ? 'Override' : 'Save'}
              </button>
              <button
                onClick={() => setEditingOutlineId(null)}
                className="px-2 py-1 bg-gray-500 text-white text-xs rounded hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
            {isPdfItem && (
              <p className="text-xs text-muted-foreground">
                This will create a custom version that overrides the PDF outline item
              </p>
            )}
          </div>
        ) : (
          <div 
            className="grid grid-cols-[1fr_24px] gap-1 w-full items-center" 
            style={{ paddingLeft: `${level * 8}px` }}
          >
            <button
              type="button"
              onClick={() => {
                const targetPage = typeof item.page === 'number' ? item.page : parseInt(String(item.page)) || 1
                console.log('Outline item clicked:', item.title, 'page:', targetPage)
                onGo(targetPage)
              }}
              className="text-left p-2 rounded-md hover:bg-muted transition-colors text-sm flex items-center justify-between bg-card border border-border/50 hover:border-border min-w-0"
              title={`Go to page ${item.page}${item.isCustom ? ' (Custom bookmark)' : ' (PDF outline)'}`}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                <span className="text-xs opacity-60 flex-shrink-0 w-4">
                  {item.isCustom ? '★' : '📄'}
                </span>
                <span 
                  className={`truncate text-xs leading-relaxed ${
                    level === 0 ? 'font-semibold' : level === 1 ? 'font-medium' : 'font-normal'
                  }`} 
                  title={item.title}
                >
                  {item.title}
                </span>
              </div>
              <span className="text-xs text-muted-foreground ml-2 flex-shrink-0 font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                {item.page}
              </span>
            </button>
            
            {/* Dropdown menu for actions - Fixed grid column */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreVertical className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="start" className="w-48">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEdit()
                  }}
                  className="text-sm"
                >
                  <Edit3 className="mr-2 h-3 w-3" />
                  {item.isCustom ? "Edit bookmark" : "Edit outline item"}
                </DropdownMenuItem>
                {item.isCustom && (
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete()
                    }}
                    className="text-sm text-red-600 focus:text-red-600"
                  >
                    <Trash2 className="mr-2 h-3 w-3" />
                    Delete bookmark
                  </DropdownMenuItem>
                )}
                {!item.isCustom && (
                  <DropdownMenuItem disabled className="text-sm text-muted-foreground">
                    <div className="mr-2 h-3 w-3 flex items-center justify-center">
                      <div className="w-1 h-1 bg-current rounded-full opacity-50"></div>
                    </div>
                    PDF outline item
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
        {item.items && item.items.length > 0 && renderOutlineItems(item.items, level + 1)}
      </div>
    )
  }

  // Recursive function to render outline items with proper nesting
  const renderOutlineItems = useMemo(() => (items: Outline[], level = 0): React.JSX.Element[] => {
    return items.map((item, index) => {
      // Create a stable key that doesn't change when page navigation occurs
      const stableKey = item.id 
        ? `outline-${item.id}` 
        : `outline-${item.isCustom ? 'custom' : 'pdf'}-${item.originalIndex || index}-${item.page}-${item.title.slice(0, 10)}`
      
      return (
        <EditableOutlineItem 
          key={stableKey}
          item={item} 
          level={level} 
          onGo={goToPage}
        />
      )
    })
  }, [goToPage, editingOutlineId, customOutlines])

  const onDocumentLoadSuccess = useCallback(async (pdf: any) => {
    console.log('PDF loaded successfully:', pdf)
    
    // Prevent double loading
    if (documentRef.current === pdf) {
      console.log('PDF already loaded, skipping...')
      return
    }
    
    setNumPages(pdf.numPages)
    documentRef.current = pdf
    setIsLoading(false)
    setPdfError(null)
    
    // Extract outline if available
    try {
      const outline = await pdf.getOutline()
      console.log('PDF outline data:', outline)
      
      if (outline && outline.length > 0) {
        const processOutline = async (items: any[]): Promise<Outline[]> => {
          const processedItems: Outline[] = []
          
          for (let i = 0; i < items.length; i++) {
            const item = items[i]
            let pageNumber = 1 // Default fallback
            
            // Multiple strategies to extract page number
            try {
              // Strategy 1: Try to extract from destination
              if (item.dest) {
                try {
                  let destination = item.dest
                  
                  // If dest is a string, resolve it first
                  if (typeof item.dest === 'string') {
                    destination = await pdf.getDestination(item.dest)
                  }
                  
                  if (destination && destination.length > 0 && destination[0]) {
                    const pageRef = destination[0]
                    
                    // Try different methods to get page index
                    if (typeof pageRef === 'object' && pageRef.num) {
                      // Direct page reference object
                      const pageIndex = await pdf.getPageIndex(pageRef)
                      pageNumber = pageIndex + 1
                    } else if (typeof pageRef === 'number') {
                      // Direct page number
                      pageNumber = pageRef + 1
                    }
                  }
                } catch (destError) {
                  console.warn('Could not resolve destination for outline item:', item.title, destError)
                }
              }
              
              // Strategy 2: Check if item has a direct page property
              if (pageNumber === 1 && item.page) {
                pageNumber = typeof item.page === 'number' ? item.page : parseInt(item.page) || 1
              }
              
              // Strategy 3: For debugging, assign incremental page numbers if all else fails
              if (pageNumber === 1 && i > 0) {
                pageNumber = i + 1 // Assign incremental page numbers as fallback
              }
              
            } catch (error) {
              console.warn('Error processing outline item page number:', item.title, error)
              pageNumber = i + 1 // Fallback to incremental numbering
            }
            
            console.log(`Outline item "${item.title}" -> Page ${pageNumber}`)
            
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
        console.log('Processed outline:', processedOutline)
        setOutline(processedOutline)
      } else {
        console.log('No outline data found in PDF')
        setOutline([])
      }
    } catch (error) {
      console.error('Error extracting outline:', error)
      setOutline([])
    }
  }, [])

  const onDocumentLoadError = useCallback((error: any) => {
    console.error('PDF load error:', error)
    console.error('File URL:', book.file_url)
    setIsLoading(false)
    setPdfError(`Failed to load PDF: ${error.message || 'Unknown error'}`)
  }, [book.file_url])

  // Get current reading mode styles
  const readingModeStyles = getReadingModeStyles(readingMode)

  const zoomIn = () => {
    setScale(prev => {
      const newScale = Math.min(prev + 0.2, 3)
      console.log('Zoom in:', prev, '->', newScale)
      return newScale
    })
  }
  
  const zoomOut = () => {
    setScale(prev => {
      const newScale = Math.max(prev - 0.2, 0.5)
      console.log('Zoom out:', prev, '->', newScale)
      return newScale
    })
  }

  // Note collapsing helpers
  const toggleNoteExpansion = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev)
      if (newSet.has(noteId)) {
        newSet.delete(noteId)
      } else {
        newSet.add(noteId)
      }
      return newSet
    })
  }

  const shouldTruncateNote = (content: string) => {
    return content.length > 100
  }

  const getTruncatedContent = (content: string, maxLength: number = 100) => {
    if (content.length <= maxLength) return content
    return content.substring(0, maxLength) + '...'
  }

  const handleTextSelection = async () => {
    console.log('handleTextSelection called, isHighlightMode:', isHighlightMode)
    if (!isHighlightMode) return
    
    const selection = window.getSelection()
    console.log('Selection:', selection)
    if (!selection || selection.isCollapsed) return
    
    const selectedText = selection.toString().trim()
    console.log('Selected text:', selectedText)
    if (!selectedText) return

    // Get precise selection rectangles for multi-line selections
    const range = selection.getRangeAt(0)
    const pageContainer = pageRef.current?.querySelector('.react-pdf__Page')
    const pageRect = pageContainer?.getBoundingClientRect()
    
    if (!pageRect) return

    // Get all client rectangles for the selection (handles multi-line selections)
    const rects = range.getClientRects()
    let selectionRects: Array<{x: number, y: number, width: number, height: number}>
    
    if (rects.length === 0) {
      // Fallback to bounding rect if no client rects available
      const boundingRect = range.getBoundingClientRect()
      if (boundingRect.width === 0 || boundingRect.height === 0) return
      
      selectionRects = [{
        x: (boundingRect.left - pageRect.left) / pageRect.width,
        y: (boundingRect.top - pageRect.top) / pageRect.height,
        width: boundingRect.width / pageRect.width,
        height: boundingRect.height / pageRect.height
      }]
    } else {
      // Convert client rects to relative positions, filtering out zero-width/height rects
      selectionRects = Array.from(rects)
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => ({
          x: (rect.left - pageRect.left) / pageRect.width,
          y: (rect.top - pageRect.top) / pageRect.height,
          width: rect.width / pageRect.width,
          height: rect.height / pageRect.height
        }))

      if (selectionRects.length === 0) return
    }
    
    // Store the main position (first rectangle) for compatibility
    const newPosition = selectionRects[0]

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('User not authenticated')
        return
      }

      // Check if a highlight already exists for this text selection
      // We'll consider it a duplicate if:
      // 1. Exact text match with similar position, OR
      // 2. Significant position overlap (indicating same or overlapping selection)
      const existingHighlight = highlights.find(h => {
        if (h.page !== pageNumber) return false
        
        // Check for exact text match with similar position
        if (h.text === selectedText && 
            Math.abs(h.position.x - newPosition.x) < 0.02 && 
            Math.abs(h.position.y - newPosition.y) < 0.02) {
          return true
        }
        
        // Check for overlapping positions (indicating overlapping selections)
        const xOverlap = Math.max(0, Math.min(h.position.x + h.position.width, newPosition.x + newPosition.width) - Math.max(h.position.x, newPosition.x))
        const yOverlap = Math.max(0, Math.min(h.position.y + h.position.height, newPosition.y + newPosition.height) - Math.max(h.position.y, newPosition.y))
        const overlapArea = xOverlap * yOverlap
        const existingArea = h.position.width * h.position.height
        const newArea = newPosition.width * newPosition.height
        const overlapRatio = overlapArea / Math.min(existingArea, newArea)
        
        // Consider it overlapping if 70% or more of the smaller selection overlaps
        return overlapRatio > 0.7
      })

      if (existingHighlight) {
        // If highlight exists, remove it (unhighlight)
        await deleteHighlight(existingHighlight.id)
        selection.removeAllRanges()
        return
      }

      // If no existing highlight, create a new one
      const highlight: Omit<Highlight, 'id' | 'createdAt'> = {
        bookId: book.id,
        page: pageNumber,
        text: selectedText,
        color: selectedHighlightColor.value,
        position: newPosition,
        rects: selectionRects
      }

      const { data, error } = await supabase
        .from('book_highlights')
        .insert({
          book_id: highlight.bookId,
          page_number: highlight.page,
          text: highlight.text,
          color: highlight.color,
          position: {
            ...highlight.position,
            rects: selectionRects // Store precise rectangles in position JSONB
          },
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

      selection.removeAllRanges()
    } catch (error) {
      console.error('Error handling highlight:', error)
    }
  }

  const handlePageClick = async (event: React.MouseEvent) => {
    if (!isNoteMode) return
    
    const pageElement = pageRef.current?.querySelector('.react-pdf__Page')
    const pageRect = pageElement?.getBoundingClientRect()
    if (!pageRect) return

    const x = (event.clientX - pageRect.left) / pageRect.width
    const y = (event.clientY - pageRect.top) / pageRect.height

    const note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'> = {
      bookId: book.id,
      page: pageNumber,
      content: 'New note',
      position: { x, y }
    }

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        console.error('User not authenticated')
        return
      }

      const { data, error } = await supabase
        .from('book_notes')
        .insert({
          book_id: note.bookId,
          page_number: note.page,
          content: note.content,
          position: note.position,
          user_id: user.id
        })
        .select()
        .single()

      if (error) throw error

      const newNote: Note = {
        ...note,
        id: data.id,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      }

      setNotes(prev => [newNote, ...prev])
      setEditingNote(newNote.id)
      setNewNoteContent(newNote.content)
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

  const currentPageHighlights = highlights.filter(h => h.page === pageNumber)
  const currentPageNotes = notes.filter(n => n.page === pageNumber)

  // Don't render complex overlays until fully hydrated and PDF is loaded
  if (!isHydrated || (isLoading && numPages === 0)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {!isHydrated ? "Initializing reader..." : "Loading PDF document..."}
          </p>
          {book.title && (
            <p className="text-xs text-muted-foreground mt-2">{book.title}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div key={`book-reader-${book.id}-${isHydrated}`} className="min-h-screen bg-background">
      <div className="flex h-screen bg-background relative">
        {/* Notes Overlay Container - positioned outside main layout */}
        {isHydrated && (
          <div
            key={`notes-overlay-${highlightUpdateTrigger}-${scrollUpdateTrigger}`}
            className="fixed inset-0 pointer-events-none z-30"
            style={{ zIndex: 30 }}
          >
            {pageNumber && currentPageNotes.map((note) => {
            // Get current PDF page element for accurate positioning
            const pageElement = pageRef.current?.querySelector('.react-pdf__Page')
            const containerElement = pageRef.current
            
            if (!pageElement || !containerElement) return null
            
            const containerRect = containerElement.getBoundingClientRect()
            const pageRect = pageElement.getBoundingClientRect()
            
            // Calculate note anchor position relative to viewport
            const noteX = pageRect.left + (note.position.x * pageRect.width)
            const noteY = pageRect.top + (note.position.y * pageRect.height)
            
            // Get viewport and PDF area dimensions
            const viewportWidth = window.innerWidth
            const viewportHeight = window.innerHeight
            const pdfAreaLeft = pageRect.left
            const pdfAreaRight = pageRect.right
            const pdfAreaTop = pageRect.top
            const pdfAreaBottom = pageRect.bottom
            
            // Calculate available space around PDF
            const spaceLeft = pdfAreaLeft
            const spaceRight = viewportWidth - pdfAreaRight
            const spaceTop = pdfAreaTop
            const spaceBottom = viewportHeight - pdfAreaBottom
            
            // Determine positioning based on highlight location within PDF
            let finalX = noteX
            let finalY = noteY
            let transform = 'translate(-50%, -100%)'
            
            // Note dimensions (estimate)
            const noteWidth = 300  // max-w-xs approximation
            const noteHeight = 100  // estimated height
            
            // Calculate PDF center and highlight position relative to PDF
            const pdfCenterX = (pdfAreaLeft + pdfAreaRight) / 2
            const pdfWidth = pdfAreaRight - pdfAreaLeft
            const highlightRelativePosition = (noteX - pdfAreaLeft) / pdfWidth // 0 = left edge, 1 = right edge
            
            // Determine which side to place the note based on highlight position
            const preferLeft = highlightRelativePosition < 0.5 // If highlight is in left half of PDF
            
            if (preferLeft && spaceLeft > noteWidth + 20) {
              // Position to the left of PDF area
              finalX = pdfAreaLeft - 10
              finalY = Math.max(noteY, pdfAreaTop + 10)
              finalY = Math.min(finalY, viewportHeight - noteHeight - 10)
              transform = 'translate(-100%, 0%)'
            } else if (!preferLeft && spaceRight > noteWidth + 20) {
              // Position to the right of PDF area
              finalX = pdfAreaRight + 10
              finalY = Math.max(noteY, pdfAreaTop + 10)
              finalY = Math.min(finalY, viewportHeight - noteHeight - 10)
              transform = 'translate(0%, 0%)'
            } else if (spaceRight > noteWidth + 20) {
              // Fallback to right if preferred side doesn't have space
              finalX = pdfAreaRight + 10
              finalY = Math.max(noteY, pdfAreaTop + 10)
              finalY = Math.min(finalY, viewportHeight - noteHeight - 10)
              transform = 'translate(0%, 0%)'
            } else if (spaceLeft > noteWidth + 20) {
              // Fallback to left if right doesn't have space
              finalX = pdfAreaLeft - 10
              finalY = Math.max(noteY, pdfAreaTop + 10)
              finalY = Math.min(finalY, viewportHeight - noteHeight - 10)
              transform = 'translate(-100%, 0%)'
            } else if (spaceBottom > noteHeight + 20) {
              // Position below PDF area if no side space
              finalX = Math.max(noteX, 10)
              finalX = Math.min(finalX, viewportWidth - noteWidth - 10)
              finalY = pdfAreaBottom + 10
              transform = 'translate(0%, 0%)'
            } else if (spaceTop > noteHeight + 20) {
              // Position above PDF area
              finalX = Math.max(noteX, 10)
              finalX = Math.min(finalX, viewportWidth - noteWidth - 10)
              finalY = pdfAreaTop - 10
              transform = 'translate(0%, -100%)'
            } else {
              // Final fallback: position at viewport edges based on highlight position
              if (preferLeft) {
                // Left edge of viewport
                finalX = 10
                finalY = Math.max(noteY, 10)
                finalY = Math.min(finalY, viewportHeight - noteHeight - 10)
                transform = 'translate(0%, 0%)'
              } else {
                // Right edge of viewport
                finalX = viewportWidth - 10
                finalY = Math.max(noteY, 10)
                finalY = Math.min(finalY, viewportHeight - noteHeight - 10)
                transform = 'translate(-100%, 0%)'
              }
            }
            
            return (
              <div key={`${note.id}-overlay-${highlightUpdateTrigger}-${scrollUpdateTrigger}`}>
                {/* Connection line from highlighted text to note */}
                <svg 
                  className="absolute pointer-events-none" 
                  style={{
                    left: 0,
                    top: 0,
                    width: '100vw',
                    height: '100vh',
                    zIndex: 25
                  }}
                >
                  <defs>
                    <marker id={`arrow-${note.id}`} viewBox="0 0 10 10" refX="9" refY="3" 
                            markerUnits="strokeWidth" markerWidth="10" markerHeight="10" orient="auto">
                      <path d="M0,0 L0,6 L9,3 z" fill="#FBB040" stroke="#FBB040" strokeWidth="1"/>
                    </marker>
                  </defs>
                  
                  {/* Connection line with arrow */}
                  <line
                    x1={noteX}
                    y1={noteY}
                    x2={finalX}
                    y2={finalY}
                    stroke="#FBB040"
                    strokeWidth="2"
                    strokeDasharray="5,3"
                    opacity="0.7"
                    markerEnd={`url(#arrow-${note.id})`}
                  />
                  
                  {/* Anchor point at highlighted text */}
                  <circle
                    cx={noteX}
                    cy={noteY}
                    r="4"
                    fill="#FBB040"
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    opacity="0.8"
                  />
                </svg>

                {/* Simple note positioned outside PDF area */}
                <div
                  className="absolute pointer-events-auto"
                  style={{
                    left: `${finalX}px`,
                    top: `${finalY}px`,
                    transform: transform,
                    zIndex: 30
                  }}
                >
                  <div className="bg-yellow-50 border border-yellow-300 rounded p-2 shadow-lg max-w-xs min-w-48">
                    <p className="text-sm text-gray-700 leading-relaxed">{note.content}</p>
                  </div>
                </div>
              </div>
            )
          })}
          </div>
        )}
        
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
                    {getMergedOutline.length > 0 ? (
                      <div className="space-y-1 bg-background/50 p-3 rounded-md border border-border/30 max-h-96 overflow-y-auto overflow-x-visible">
                        {renderOutlineItems(getMergedOutline)}
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground py-8">
                        <BookOpen className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No bookmarks available</p>
                        <p className="text-xs mt-1">Add custom bookmarks or use a PDF with embedded outline</p>
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
                  {notes.map((note) => (
                    <div key={note.id} className="p-3 border border-border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          Page {note.page}
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
                        <p 
                          className="text-sm cursor-pointer hover:bg-muted p-2 rounded"
                          onClick={() => goToPage(note.page)}
                        >
                          {note.content}
                        </p>
                      )}
                    </div>
                  ))}
                  {notes.length === 0 && (
                    <div className="text-center text-muted-foreground py-8">
                      <StickyNote className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No notes yet</p>
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
                      Select text to highlight • Click highlights to remove
                    </div>
                  </>
                )}
              </div>

              {/* Note Mode */}
              <Button
                variant={isNoteMode ? "default" : "outline"}
                size="sm"
                onClick={() => setIsNoteMode(!isNoteMode)}
              >
                <StickyNote className="w-4 h-4" />
              </Button>

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
            </div>

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

        {/* PDF Viewer */}
        <div className={`flex-1 overflow-auto ${readingModeStyles.background}`}>
          <div className="flex justify-center">
            <div className="w-full">
              <div 
                ref={pageRef}
                className={`pdf-viewer-container relative ${readingModeStyles.containerBg} transition-all duration-300 overflow-visible`}
                style={{ filter: readingModeStyles.filter }}
                onMouseUp={handleTextSelection}
                onClick={handlePageClick}
              >
              {pdfError ? (
                <div className={`flex items-center justify-center p-8 ${readingModeStyles.containerBg} min-h-screen`}>
                  <div className="text-center">
                    <p className={`text-red-500 mb-4 ${readingModeStyles.textColor}`}>Failed to load PDF file</p>
                    <p className={`text-sm text-muted-foreground mb-4 ${readingModeStyles.textColor}`}>{pdfError}</p>
                    <p className="text-xs text-muted-foreground mb-4">
                      URL: {book.file_url}
                    </p>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setPdfError(null)
                        setIsLoading(true)
                        window.location.reload()
                      }}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <Document
                  file={book.file_url}
                  onLoadSuccess={onDocumentLoadSuccess}
                  onLoadError={onDocumentLoadError}
                  loading={
                    <div className={`flex items-center justify-center p-8 ${readingModeStyles.containerBg} min-h-[600px]`}>
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className={`text-muted-foreground ${readingModeStyles.textColor}`}>Loading PDF...</p>
                        <p className={`text-xs text-muted-foreground mt-2 ${readingModeStyles.textColor}`}>
                          File: {book.title}
                        </p>
                      </div>
                    </div>
                  }
                  ref={documentRef}
                  options={PDF_OPTIONS}
                >
                  <div className="flex items-center justify-center min-h-screen">
                    <Page
                      pageNumber={pageNumber}
                      scale={scale}
                      renderTextLayer={true}
                      renderAnnotationLayer={false}
                      onLoadSuccess={() => {
                        // Trigger highlight re-positioning after page loads
                        setTimeout(() => {
                          setHighlightUpdateTrigger(prev => prev + 1)
                        }, 50)
                      }}
                      loading={
                        <div className={`flex items-center justify-center ${readingModeStyles.containerBg} min-h-screen`}>
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                        </div>
                      }
                    />
                  </div>
                </Document>
              )}

              {/* Overlay Highlights */}
              {isHydrated && (
                <div key={highlightUpdateTrigger}>
                  {currentPageHighlights.map((highlight) => {
                  return (
                    <div key={highlight.id}>
                      {(highlight.rects || [highlight.position]).map((rect, index) => {
                        // Get current PDF page element for accurate positioning
                        const pageElement = pageRef.current?.querySelector('.react-pdf__Page')
                        const containerElement = pageRef.current
                        
                        if (!pageElement || !containerElement) {
                          console.log('PDF elements not found for highlight positioning')
                          return null
                        }
                        
                        const containerRect = containerElement.getBoundingClientRect()
                        const pageRect = pageElement.getBoundingClientRect()
                        
                        // Calculate offset of PDF page within container
                        const offsetX = pageRect.left - containerRect.left
                        const offsetY = pageRect.top - containerRect.top
                        
                        const left = offsetX + (rect.x * pageRect.width)
                        const top = offsetY + (rect.y * pageRect.height)
                        const width = rect.width * pageRect.width
                        const height = rect.height * pageRect.height
                        
                        return (
                          <div
                            key={`${highlight.id}-${index}-${highlightUpdateTrigger}`}
                            className={`absolute cursor-pointer hover:ring-1 hover:ring-primary/50 transition-all ${
                              isHighlightMode ? 'pointer-events-auto' : 'pointer-events-none'
                            }`}
                            style={{
                              left: `${left}px`,
                              top: `${top}px`,
                              width: `${width}px`,
                              height: `${height}px`,
                              backgroundColor: highlight.color + (isHighlightMode ? '80' : '60'),
                              borderRadius: '2px',
                              zIndex: 10
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              if (isHighlightMode) {
                                deleteHighlight(highlight.id)
                              }
                            }}
                            title={isHighlightMode ? 'Click to remove highlight' : highlight.text}
                          />
                        )
                      })}
                    </div>
                  )
                })}
                </div>
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
