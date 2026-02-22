'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Highlighter, BookOpen, Calendar, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useAuth } from '@/hooks/use-auth'
import { toast } from 'sonner'

interface Highlight {
  id: string
  book_id: number
  user_id: string
  text: string
  color: string
  page_number: number
  position: any
  created_at: string
}

interface Book {
  id: number
  title: string
  author: string | null
  cover_url: string | null
}

export default function HighlightsPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const bookId = params.id as string
  const { user } = useAuth()
  
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [groupByPage, setGroupByPage] = useState(true)

  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [bookId, user])

  const loadData = async () => {
    setLoading(true)
    try {
      // Load book info from D1 API
      const bookResponse = await fetch(`/api/books/${bookId}`, { cache: "no-store" })
      const bookResult = await bookResponse.json().catch(() => null)
      if (!bookResponse.ok || !bookResult?.success || !bookResult?.book) {
        throw new Error(bookResult?.details || bookResult?.error || "Failed to load book")
      }
      setBook(bookResult.book)

      // Load highlights
      const highlightsResponse = await fetch(`/api/book-highlights?bookId=${bookId}`, {
        cache: "no-store",
        headers: {
          "x-user-id": user!.id,
        },
      })
      const highlightsResult = await highlightsResponse.json().catch(() => null)
      if (!highlightsResponse.ok || !highlightsResult?.success) {
        throw new Error(highlightsResult?.details || highlightsResult?.error || "Failed to load highlights")
      }
      setHighlights((highlightsResult.highlights || []) as Highlight[])
    } catch (error) {
      console.error('Error loading highlights:', error)
      toast.error('Failed to load highlights')
    } finally {
      setLoading(false)
    }
  }

  const deleteHighlight = async (highlightId: string) => {
    if (!confirm('Are you sure you want to delete this highlight?')) return

    try {
      const response = await fetch(`/api/book-highlights/${encodeURIComponent(highlightId)}`, {
        method: "DELETE",
        headers: {
          "x-user-id": user!.id,
        },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to delete highlight")
      }

      setHighlights(highlights.filter(h => h.id !== highlightId))
      toast.success('Highlight deleted')
    } catch (error) {
      console.error('Error deleting highlight:', error)
      toast.error('Failed to delete highlight')
    }
  }

  const groupedHighlights = groupByPage
    ? highlights.reduce((acc, highlight) => {
        const page = highlight.page_number
        if (!acc[page]) acc[page] = []
        acc[page].push(highlight)
        return acc
      }, {} as Record<number, Highlight[]>)
    : null

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading highlights...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link href={`/books/${bookId}`}>
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Book
          </Button>
        </Link>

        <div className="flex items-start gap-6 mb-6">
          {book?.cover_url && (
            <div className="w-24 h-32 relative rounded-md overflow-hidden flex-shrink-0">
              <img
                src={book.cover_url}
                alt={book.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{book?.title}</h1>
            {book?.author && (
              <p className="text-lg text-muted-foreground mb-4">{book.author}</p>
            )}
            <div className="flex items-center gap-4">
              <Badge variant="secondary" className="text-base">
                <Highlighter className="w-4 h-4 mr-2" />
                {highlights.length} Highlights
              </Badge>
              <Button size="sm" asChild>
                <Link href={`/books/${bookId}/reader`}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Open Reader
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* View Options */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-muted-foreground">View:</span>
          <Button
            variant={groupByPage ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupByPage(true)}
          >
            By Page
          </Button>
          <Button
            variant={!groupByPage ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupByPage(false)}
          >
            All
          </Button>
        </div>
      </div>

      {/* Highlights Content */}
      {highlights.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Highlighter className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No highlights yet</h3>
              <p className="text-muted-foreground mb-6">
                Start highlighting important passages while reading this book
              </p>
              <Button asChild>
                <Link href={`/books/${bookId}/reader`}>
                  <BookOpen className="w-4 h-4 mr-2" />
                  Start Reading
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : groupByPage && groupedHighlights ? (
        /* Grouped by Page View */
        <div className="space-y-6">
          {Object.entries(groupedHighlights)
            .sort(([pageA], [pageB]) => Number(pageA) - Number(pageB))
            .map(([page, pageHighlights]) => (
              <Card key={page}>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="text-lg">Page {page}</span>
                    <Badge variant="secondary">{pageHighlights.length} highlights</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {pageHighlights.map((highlight) => (
                      <div
                        key={highlight.id}
                        className="border-l-4 pl-4 py-2 rounded-r-md hover:bg-muted/50 transition-colors relative group"
                        style={{ borderLeftColor: highlight.color }}
                      >
                        <p className="text-base mb-2 leading-relaxed">{highlight.text}</p>
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            {new Date(highlight.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8"
                              asChild
                            >
                              <Link href={`/books/${bookId}/reader?page=${highlight.page_number}`}>
                                <BookOpen className="w-3 h-3 mr-1" />
                                View in Reader
                              </Link>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive"
                              onClick={() => deleteHighlight(highlight.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
        </div>
      ) : (
        /* All Highlights View */
        <Card>
          <CardContent className="p-6">
            <div className="space-y-4">
              {highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className="border-l-4 pl-4 py-3 rounded-r-md hover:bg-muted/50 transition-colors relative group"
                  style={{ borderLeftColor: highlight.color }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="outline" className="text-xs">
                      Page {highlight.page_number}
                    </Badge>
                  </div>
                  <p className="text-base mb-2 leading-relaxed">{highlight.text}</p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {new Date(highlight.created_at).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </div>
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8"
                        asChild
                      >
                        <Link href={`/books/${bookId}/reader?page=${highlight.page_number}`}>
                          <BookOpen className="w-3 h-3 mr-1" />
                          View in Reader
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-destructive hover:text-destructive"
                        onClick={() => deleteHighlight(highlight.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
