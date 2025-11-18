"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Calendar, User, Building, BookPlus, Check, BookOpen, FileText, Plus, Tag, Edit, Highlighter, Video, ExternalLink } from "lucide-react"
import { createClient } from "@/lib/supabase"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"
import { BookActions } from "@/components/book-actions"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"

interface BookDetailPageProps {
  params: Promise<{ id: string }> | { id: string }
}

interface BookNote {
  id: string
  book_id: number
  page_number: number
  content: string
  position: any
  user_id: string
  created_at: string
  updated_at: string
}

interface StudyNote {
  id: number
  title: string
  content: string
  book_id: number | null
  user_id: string
  tags: string | null
  category: string | null
  created_at: string
  updated_at: string
}

interface Highlight {
  id: number
  book_id: number
  user_id: string
  text: string
  color: string
  page_number: number
  created_at: string
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
  video_url: string | null
  video_file_url: string | null
  video_title: string | null
  video_description: string | null
}

async function getBook(id: string) {
  const supabase = createClient()
  // Fetch book details
  const { data: book, error: bookError } = await supabase.from("Booklist").select("*").eq("id", id).single()

  if (bookError || !book) {
    return null
  }

  // Generate signed URLs for cover and file
  let coverUrl = book.cover_url
  let fileUrl = book.file_url

  // Only generate signed URL if file path exists
  if (coverUrl) {
    const { data: signedCover, error: coverError } = await supabase.storage
      .from("book-cover")
      .createSignedUrl(coverUrl.replace(/^book-cover\//, ""), 60 * 60 * 24)
    if (!coverError && signedCover?.signedUrl) {
      coverUrl = signedCover.signedUrl
    }
  }

  if (fileUrl) {
    const { data: signedFile, error: fileError } = await supabase.storage
      .from("book-file")
      .createSignedUrl(fileUrl.replace(/^book-file\//, ""), 60 * 60 * 24)
    if (!fileError && signedFile?.signedUrl) {
      fileUrl = signedFile.signedUrl
    }
  }

  // Create book with signed URLs
  return { ...book, cover_url: coverUrl, file_url: fileUrl }
}

export default function BookDetailPage({ params }: BookDetailPageProps) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null)
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [isInReadingList, setIsInReadingList] = useState(false)
  const [readingListStatus, setReadingListStatus] = useState<"to_read" | "reading" | "completed" | null>(null)
  const [addingToList, setAddingToList] = useState(false)
  const [readerNotes, setReaderNotes] = useState<BookNote[]>([])
  const [readerNotesLoading, setReaderNotesLoading] = useState(true)
  const [studyNotes, setStudyNotes] = useState<StudyNote[]>([])
  const [studyNotesLoading, setStudyNotesLoading] = useState(true)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [highlightsLoading, setHighlightsLoading] = useState(true)
  const { user, loading: authLoading } = useAuth()

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
          // params is a direct object - cast through unknown to handle type checking
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
    if (resolvedParams && !authLoading) {
      initializePage()
    }
  }, [resolvedParams, user, authLoading])

  const initializePage = async () => {
    if (!resolvedParams) return
    
    const bookData = await getBook(resolvedParams.id)

    if (!bookData) {
      notFound()
      return
    }

    setBook(bookData)
    
    // Only fetch user-specific data if authenticated
    if (user) {
      await checkReadingListStatus(bookData.id)
      await Promise.all([
        fetchReaderNotes(bookData.id),
        fetchStudyNotes(bookData.id),
        fetchBookHighlights(bookData.id)
      ])
    } else {
      setReaderNotesLoading(false)
      setStudyNotesLoading(false)
      setHighlightsLoading(false)
    }
    
    setLoading(false)
  }

  const fetchReaderNotes = async (bookId: number) => {
    if (!user) {
      console.log("No user logged in, skipping reader notes fetch")
      setReaderNotesLoading(false)
      return
    }
    
    try {
      console.log("Fetching reader notes for book:", bookId, "user:", user.id)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("book_notes")
        .select("*")
        .eq("book_id", bookId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Supabase error fetching reader notes:", error)
        setReaderNotes([])
      } else {
        console.log("Reader notes fetched successfully:", data?.length || 0, "notes")
        setReaderNotes(data || [])
      }
    } catch (error) {
      console.error("Error fetching reader notes:", error)
      setReaderNotes([])
    } finally {
      setReaderNotesLoading(false)
    }
  }

  const fetchStudyNotes = async (bookId: number) => {
    if (!user) {
      console.log("No user logged in, skipping study notes fetch")
      setStudyNotesLoading(false)
      return
    }
    
    try {
      console.log("Fetching study notes for book:", bookId, "user:", user.id)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("study_notes")
        .select("*")
        .eq("book_id", bookId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Supabase error fetching study notes:", error)
        setStudyNotes([])
      } else {
        console.log("Study notes fetched successfully:", data?.length || 0, "notes")
        setStudyNotes(data || [])
      }
    } catch (error) {
      console.error("Error fetching study notes:", error)
      setStudyNotes([])
    } finally {
      setStudyNotesLoading(false)
    }
  }

  const fetchBookHighlights = async (bookId: number) => {
    if (!user) {
      console.log("No user logged in, skipping highlights fetch")
      setHighlightsLoading(false)
      return
    }
    
    try {
      console.log("Fetching highlights for book:", bookId, "user:", user.id)
      const supabase = createClient()
      const { data, error } = await supabase
        .from("book_highlights")
        .select("*")
        .eq("book_id", bookId)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Supabase error fetching highlights:", error)
        setHighlights([])
      } else {
        console.log("Highlights fetched successfully:", data?.length || 0, "highlights")
        setHighlights(data || [])
      }
    } catch (error) {
      console.error("Error fetching book highlights:", error)
      setHighlights([])
    } finally {
      setHighlightsLoading(false)
    }
  }

  const checkReadingListStatus = async (bookId: number) => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from("reading_list_full").select("status").eq("book_id", bookId).single()

      if (error && error.code !== "PGRST116") {
        // PGRST116 is "not found" error
        // Check if it's a table not found error (PGRST106 or similar)
        if (error.code === "PGRST106" || error.message?.includes("does not exist")) {
          console.warn("Reading list table not found. Please run database setup scripts.")
          setIsInReadingList(false)
          setReadingListStatus(null)
          return
        }
        
        console.error("Reading list query error:", {
          error: error,
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint
        })
        throw error
      }

      if (data) {
        setIsInReadingList(true)
        setReadingListStatus(data.status)
      } else {
        setIsInReadingList(false)
        setReadingListStatus(null)
      }
    } catch (error: any) {
      console.warn("Reading list functionality unavailable:", error?.message || error)
      // Set default state on error to prevent app crash
      setIsInReadingList(false)
      setReadingListStatus(null)
    }
  }

  const addToReadingList = async () => {
    if (!book || addingToList) return

    setAddingToList(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.from("reading_list_full").insert([
        {
          book_id: book.id,
          status: "to_read",
        },
      ])

      if (error) throw error

      setIsInReadingList(true)
      setReadingListStatus("to_read")
      toast.success("Book added to reading list!")
    } catch (error) {
      console.error("Error adding to reading list:", error)
      toast.error("Failed to add book to reading list")
    } finally {
      setAddingToList(false)
    }
  }

  const removeFromReadingList = async () => {
    if (!book || addingToList) return

    setAddingToList(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.from("reading_list_full").delete().eq("book_id", book.id)

      if (error) throw error

      setIsInReadingList(false)
      setReadingListStatus(null)
      toast.success("Book removed from reading list")
    } catch (error) {
      console.error("Error removing from reading list:", error)
      toast.error("Failed to remove book from reading list")
    } finally {
      setAddingToList(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading book details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!book) {
    notFound()
  }

  const getStatusDisplay = () => {
    const statusLabels = {
      to_read: "To Read",
      reading: "Currently Reading",
      completed: "Completed",
    }

    return readingListStatus ? statusLabels[readingListStatus] : null
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <Link href="/books">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Books
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Book Cover and Actions */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden">
                <Image
                  src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                  alt={book.title || "Book cover"}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, 300px"
                  priority
                  onError={(e) => {
                    console.error("Image failed to load:", book.cover_url)
                    // Fallback to placeholder if image fails to load
                    e.currentTarget.src = "/abstract-book-cover.png"
                  }}
                />
              </div>

              {/* Reading List Actions - Only for authenticated users */}
              {user && (
                <div className="mb-4 space-y-2">
                  {!isInReadingList ? (
                    <Button onClick={addToReadingList} className="w-full" disabled={addingToList}>
                      {addingToList ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <BookPlus className="w-4 h-4 mr-2" />
                          Add to Reading List
                        </>
                      )}
                    </Button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-center gap-2 p-2 bg-primary/10 rounded-md text-primary text-sm">
                        <Check className="w-4 h-4" />
                        <span>In Reading List ({getStatusDisplay()})</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                          <Link href="/reading-list">
                            <BookOpen className="w-3 h-3 mr-1" />
                            View List
                          </Link>
                        </Button>
                        <Button variant="destructive" size="sm" onClick={removeFromReadingList} disabled={addingToList}>
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <BookActions bookId={book.id.toString()} fileUrl={book.file_url || undefined} />
            </CardContent>
          </Card>
        </div>

        {/* Book Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl md:text-2xl text-balance">{book.title || "Untitled"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 text-base text-muted-foreground">
                {book.author && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{book.author}</span>
                  </div>
                )}
                {book.publisher && (
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    <span>{book.publisher}</span>
                  </div>
                )}
                {book.year && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{book.year}</span>
                  </div>
                )}
              </div>

              {book.description && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-base text-muted-foreground leading-relaxed">{book.description}</p>
                </div>
              )}

              {book.isbn && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">ISBN</h3>
                  <p className="text-base text-muted-foreground font-mono">{book.isbn}</p>
                </div>
              )}

              {book.tags && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {book.tags
                      .split(/[,，、]+/)
                      .map(t => t.trim())
                      .filter(t => t.length > 0)
                      .map((tag, index) => (
                        <Badge key={index} variant="secondary" className="text-sm">
                          {tag}
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Highlights Section - Only for authenticated users */}
          {user && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Highlighter className="w-5 h-5" />
                    Highlights
                    <Badge variant="secondary">{highlights.length}</Badge>
                  </CardTitle>
                  <Button size="sm" asChild>
                    <Link href={`/books/${book.id}/reader`}>
                      <BookOpen className="w-4 h-4 mr-1" />
                      Open Reader
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {highlightsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                      <p className="text-sm text-muted-foreground">Loading highlights...</p>
                    </div>
                  </div>
                ) : highlights.length === 0 ? (
                  <div className="text-center py-8">
                    <Highlighter className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                    <h4 className="text-xl font-medium mb-2">No highlights yet</h4>
                    <p className="text-base text-muted-foreground mb-4">
                      Start highlighting important passages while reading
                    </p>
                    <Button size="sm" asChild>
                      <Link href={`/books/${book.id}/reader`}>
                        <BookOpen className="w-4 h-4 mr-1" />
                        Start Reading
                      </Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {highlights.slice(0, 3).map((highlight) => (
                      <div
                        key={highlight.id}
                        className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                        style={{
                          borderLeftWidth: '4px',
                          borderLeftColor: highlight.color
                        }}
                      >
                        <p className="text-sm mb-2 line-clamp-3">{highlight.text}</p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Page {highlight.page_number}</span>
                          <span>{new Date(highlight.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}

                    {highlights.length > 3 && (
                      <div className="pt-2 border-t border-border">
                        <Button variant="outline" size="sm" asChild className="w-full bg-transparent">
                          <Link href={`/books/${book.id}/highlights`}>
                            View All Highlights ({highlights.length})
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Reader Notes Section - From PDF reader */}
          {user && readerNotes.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="w-5 h-5" />
                    Reader Notes
                    <Badge variant="secondary">{readerNotes.length}</Badge>
                  </CardTitle>
                  <Button size="sm" asChild>
                    <Link href={`/books/${book.id}/reader`}>
                      <BookOpen className="w-4 h-4 mr-1" />
                      Open Reader
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {readerNotes.slice(0, 3).map((note) => (
                  <div
                    key={note.id}
                    className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Page {note.page_number}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        asChild
                        className="h-6 px-2"
                      >
                        <Link href={`/books/${book.id}/reader?page=${note.page_number}`}>
                          <BookOpen className="w-3 h-3 mr-1" />
                          View
                        </Link>
                      </Button>
                    </div>

                    {note.content && (
                      <p className="text-sm text-foreground line-clamp-3 mb-2">
                        {note.content}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{new Date(note.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}

                {readerNotes.length > 3 && (
                  <div className="pt-2 border-t border-border">
                    <Button variant="outline" size="sm" asChild className="w-full bg-transparent">
                      <Link href={`/books/${book.id}/reader`}>View All Reader Notes ({readerNotes.length})</Link>
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
            </Card>
          )}

          {/* Study Notes Section - From /notes page */}
          {user && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Study Notes
                    <Badge variant="secondary">{studyNotes.length}</Badge>
                  </CardTitle>
                  <Button size="sm" asChild>
                    <Link href={`/notes/new?bookId=${book.id}`}>
                      <Plus className="w-4 h-4 mr-1" />
                      Add Note
                    </Link>
                  </Button>
                </div>
              </CardHeader>
            <CardContent>
              {studyNotesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">Loading notes...</p>
                  </div>
                </div>
              ) : studyNotes.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <h4 className="text-xl font-medium mb-2">No study notes yet</h4>
                  <p className="text-base text-muted-foreground mb-4">Create detailed notes for this book</p>
                  <Button size="sm" asChild>
                    <Link href={`/notes/new?bookId=${book.id}`}>
                      <Plus className="w-4 h-4 mr-1" />
                      Create First Note
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {studyNotes.slice(0, 3).map((note) => (
                    <Link
                      key={note.id}
                      href={`/notes/${note.id}`}
                      className="block border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      {note.title && note.title !== note.content.substring(0, 50) && note.title !== "Untitled Note" && (
                        <div className="mb-2">
                          <div className="text-lg font-medium hover:text-primary transition-colors">
                            {note.title}
                          </div>
                        </div>
                      )}

                      {note.content && (
                        <p className="text-base text-muted-foreground line-clamp-2 mb-2">
                          {note.content.replace(/<[^>]*>/g, "").substring(0, 150)}
                          {note.content.length > 150 && "..."}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <div className="flex flex-wrap gap-2">
                          {note.category && (
                            <Badge variant="outline" className="text-sm">
                              {note.category}
                            </Badge>
                          )}
                          {note.tags &&
                            note.tags
                              .split(",")
                              .slice(0, 2)
                              .map((tag: string, index: number) => (
                                <Badge key={index} variant="secondary" className="text-sm">
                                  <Tag className="w-2 h-2 mr-1" />
                                  {tag.trim()}
                                </Badge>
                              ))}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="w-3 h-3 mr-1" />
                          {new Date(note.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </Link>
                  ))}

                  {studyNotes.length > 3 && (
                    <div className="pt-2 border-t border-border">
                      <Button variant="outline" size="sm" asChild className="w-full bg-transparent">
                        <Link href={`/notes?bookId=${book.id}`}>View All Notes ({studyNotes.length})</Link>
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            </Card>
          )}

          {/* Related Videos Section */}
          {(book.video_url || book.video_file_url) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Video className="w-5 h-5" />
                  Related Videos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* External Video Link */}
                  {book.video_url && (
                    <div className="border border-border rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-medium">{book.video_title || "Related Video"}</h4>
                        <Button size="sm" variant="outline" asChild>
                          <a href={book.video_url} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Watch
                          </a>
                        </Button>
                      </div>
                      {book.video_description && (
                        <p className="text-sm text-muted-foreground mb-3">{book.video_description}</p>
                      )}
                      {/* Embed video if it's a YouTube link */}
                      {book.video_url.includes('youtube.com') || book.video_url.includes('youtu.be') ? (
                        <div className="aspect-video bg-muted rounded-md overflow-hidden">
                          <iframe
                            src={book.video_url.replace('watch?v=', 'embed/').replace('youtu.be/', 'youtube.com/embed/')}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        </div>
                      ) : null}
                    </div>
                  )}

                  {/* Uploaded Video File */}
                  {book.video_file_url && (
                    <div className="border border-border rounded-lg p-4">
                      <h4 className="font-medium mb-3">
                        {book.video_title || "Uploaded Video"}
                      </h4>
                      {book.video_description && (
                        <p className="text-sm text-muted-foreground mb-3">{book.video_description}</p>
                      )}
                      <div className="aspect-video bg-black rounded-md overflow-hidden">
                        <video
                          controls
                          className="w-full h-full"
                          src={book.video_file_url}
                        >
                          Your browser does not support the video tag.
                        </video>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
