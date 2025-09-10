"use client"

import { useState, useEffect } from "react"
import { BookCard } from "@/components/book-card"
import { createClient, type Book } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

const BOOKS_PER_PAGE = 9

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

      // Generate signed URLs for cover and file
      const booksWithSignedUrls = await Promise.all(
        (data || []).map(async (book) => {
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

          return { ...book, cover_url: coverUrl, file_url: fileUrl }
        }),
      )

      setBooks(booksWithSignedUrls)
    } catch (error) {
      console.error("Error fetching books:", error)
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
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-primary text-balance">Book Collection</h1>
          <p className="text-muted-foreground mt-2">Browse and manage your personal library</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-foreground">All Books</h2>
          <div className="text-sm text-muted-foreground">
            {totalBooks} {totalBooks === 1 ? "book" : "books"} total
            {totalPages > 1 && (
              <span className="ml-2">
                (Page {currentPage} of {totalPages})
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: BOOKS_PER_PAGE }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted rounded-lg h-80"></div>
              </div>
            ))}
          </div>
        ) : totalBooks === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground text-lg mb-2">No books in your collection yet</div>
            <p className="text-sm text-muted-foreground">Add your first book using the upload page</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {books.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onBookDeleted={handleBookDeleted}
                  canEdit={user && book.user_id === user.id} // Only owner can edit/delete
                />
              ))}
            </div>

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
