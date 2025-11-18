"use client"

import { useState, useEffect } from "react"
import { BookCard } from "@/components/book-card"
import { createClient, type Book } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Grid3x3, List, Book as BookIcon } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

const BOOKS_PER_PAGE = 12

// Add this hook to get the current user
function useAuthUser() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
  }, [])
  return user
}

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [totalBooks, setTotalBooks] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const supabase = createClient()
  const user = useAuthUser() // Get the current user

  const totalPages = Math.ceil(totalBooks / BOOKS_PER_PAGE)

  const fetchBooks = async (page: number = 1) => {
    setIsLoading(true)
    try {
      // First, get the total count
      const { count, error: countError } = await supabase
        .from("Booklist")
        .select("*", { count: "exact", head: true })

      if (countError) throw countError
      setTotalBooks(count || 0)

      // Then fetch the paginated data
      const from = (page - 1) * BOOKS_PER_PAGE
      const to = from + BOOKS_PER_PAGE - 1

      const { data, error } = await supabase
        .from("Booklist")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to)

      if (error) throw error

      // Fetch reading progress for current user if authenticated
      let readingProgress: any = {}
      if (user) {
        const { data: progressData, error: progressError } = await supabase
          .from("book_tracking")
          .select("book_id, current_page, total_pages, progress_percentage, last_read_at")
          .eq("user_id", (user as any).id)
        
        if (progressError) {
          console.warn('Failed to fetch reading progress:', progressError)
        }
        
        if (progressData) {
          readingProgress = progressData.reduce((acc: any, item: any) => {
            acc[item.book_id] = item
            return acc
          }, {})
        }
      }

      // Generate signed URLs for cover and file
      const booksWithSignedUrls = await Promise.all(
        (data || []).map(async (book) => {
          try {
            let coverUrl = book.cover_url
            let fileUrl = book.file_url

            // Only generate signed URL if file path exists
            if (coverUrl) {
              const { data: signedCover, error: coverError } = await supabase.storage
                .from("book-cover")
                .createSignedUrl(coverUrl.replace(/^book-cover\//, ""), 60 * 60 * 24)
              if (!coverError && signedCover?.signedUrl) {
                coverUrl = signedCover.signedUrl
              } else if (coverError) {
                console.warn(`Failed to generate signed URL for cover of book ${book.id}:`, coverError)
              }
            }

            if (fileUrl) {
              const { data: signedFile, error: fileError } = await supabase.storage
                .from("book-file")
                .createSignedUrl(fileUrl.replace(/^book-file\//, ""), 60 * 60 * 24)
              if (!fileError && signedFile?.signedUrl) {
                fileUrl = signedFile.signedUrl
              } else if (fileError) {
                console.warn(`Failed to generate signed URL for file of book ${book.id}:`, fileError)
              }
            }

            const bookProgress = readingProgress[book.id]
            return { 
              ...book, 
              cover_url: coverUrl, 
              file_url: fileUrl,
              current_page: bookProgress?.current_page || 0,
              total_pages: bookProgress?.total_pages || 0,
              progress_percentage: bookProgress?.progress_percentage || 0,
              last_read_at: bookProgress?.last_read_at || null
            }
          } catch (bookError) {
            console.error(`Error processing book ${book.id}:`, bookError)
            // Return book with original URLs if processing fails
            return {
              ...book,
              current_page: 0,
              total_pages: 0,
              progress_percentage: 0,
              last_read_at: null
            }
          }
        }),
      )

      setBooks(booksWithSignedUrls)
    } catch (error) {
      console.error("Error fetching books:", error)
      console.error("Error details:", JSON.stringify(error, null, 2))
    } finally {
      setIsLoading(false)
    }
  }

  const handleBookDeleted = () => {
    // If we're on a page that no longer has books after deletion, go to the previous page
    const newTotalBooks = totalBooks - 1
    const newTotalPages = Math.ceil(newTotalBooks / BOOKS_PER_PAGE)
    
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages)
      fetchBooks(newTotalPages)
    } else {
      fetchBooks(currentPage)
    }
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    fetchBooks(page)
    // Scroll to top when changing pages
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    fetchBooks(currentPage)
    // eslint-disable-next-line
  }, [user]) // Re-fetch when user changes

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary text-balance">Book Collection</h1>
          <p className="text-lg text-muted-foreground mt-2">Browse and manage your personal library</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-xl md:text-2xl font-semibold text-foreground">All Books</h2>
            <div className="flex items-center gap-2 border rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 p-0"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-base text-muted-foreground">
            {totalBooks} {totalBooks === 1 ? "book" : "books"} total
            {totalPages > 1 && (
              <span className="ml-2">
                (Page {currentPage} of {totalPages})
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: BOOKS_PER_PAGE }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted rounded-lg h-80"></div>
              </div>
            ))}
          </div>
        ) : totalBooks === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground text-xl mb-2">No books in your collection yet</div>
            <p className="text-base text-muted-foreground">Add your first book using the upload page</p>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onBookDeleted={handleBookDeleted}
                    canEdit={!!(user && book.user_id === (user as any).id)} // Only owner can edit/delete
                    isAuthenticated={!!user} // Pass authentication status
                  />
                ))}
              </div>
            ) : (
              <div className="bg-card border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-sm">书籍</th>
                      <th className="text-left px-4 py-3 font-semibold text-sm">详情</th>
                      <th className="text-left px-4 py-3 font-semibold text-sm">类型</th>
                      <th className="text-center px-4 py-3 font-semibold text-sm">页数</th>
                      <th className="text-left px-4 py-3 font-semibold text-sm">阅读进度</th>
                      <th className="text-center px-4 py-3 font-semibold text-sm">最近阅读</th>
                      <th className="text-center px-4 py-3 font-semibold text-sm">创建时间</th>
                      <th className="text-center px-4 py-3 font-semibold text-sm">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((book) => (
                      <tr key={book.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/books/${book.id}`} className="flex items-center gap-3 hover:underline">
                            {book.cover_url ? (
                              <Image
                                src={book.cover_url}
                                alt={book.title || "Book cover"}
                                width={40}
                                height={56}
                                className="rounded object-cover"
                              />
                            ) : (
                              <div className="w-10 h-14 bg-muted rounded flex items-center justify-center">
                                <BookIcon className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <span className="font-medium line-clamp-2">{book.title}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-muted-foreground">
                            {book.author && <div>作者: {book.author}</div>}
                            {book.publisher && <div>出版社: {book.publisher}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {book.tags && (
                            <div className="flex flex-wrap gap-1">
                              {book.tags.split(/[,，、]+/).slice(0, 2).map((tag, index) => {
                                const trimmedTag = tag.trim()
                                return trimmedTag ? (
                                  <Badge key={index} variant="secondary" className="text-xs">
                                    {trimmedTag}
                                  </Badge>
                                ) : null
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                          {(book as any).total_pages > 0 ? (book as any).total_pages : '-'}
                        </td>
                        <td className="px-4 py-3">
                          {(book as any).total_pages > 0 ? (
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground min-w-[3rem]">
                                  {Math.round((book as any).progress_percentage || 0)}%
                                </span>
                                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                                  <div 
                                    className="bg-primary h-full transition-all duration-300"
                                    style={{ width: `${Math.min((book as any).progress_percentage || 0, 100)}%` }}
                                  />
                                </div>
                              </div>
                              {(book as any).current_page > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {(book as any).current_page} / {(book as any).total_pages} 页
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">未开始</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                          {(book as any).last_read_at ? (
                            <div className="space-y-0.5">
                              <div>{new Date((book as any).last_read_at).toLocaleDateString('zh-CN')}</div>
                              <div className="text-xs opacity-70">
                                {new Date((book as any).last_read_at).toLocaleTimeString('zh-CN', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                })}
                              </div>
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-muted-foreground">
                          {new Date(book.created_at).toLocaleDateString('zh-CN')}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {book.file_url && book.file_url.toLowerCase().includes('pdf') && (
                              <Link href={`/books/${book.id}/reader`}>
                                <Button variant="outline" size="sm">
                                  阅读
                                </Button>
                              </Link>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center space-x-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber
                    if (totalPages <= 5) {
                      pageNumber = i + 1
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i
                    } else {
                      pageNumber = currentPage - 2 + i
                    }

                    return (
                      <Button
                        key={pageNumber}
                        variant={currentPage === pageNumber ? "default" : "outline"}
                        size="sm"
                        onClick={() => handlePageChange(pageNumber)}
                        className="min-w-[2.5rem]"
                      >
                        {pageNumber}
                      </Button>
                    )
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
