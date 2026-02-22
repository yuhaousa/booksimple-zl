"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Book as BookIcon, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Grid3x3, List } from "lucide-react"

import { BookCard } from "@/components/book-card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Book = {
  id: number
  created_at: string
  title: string | null
  description: string | null
  author: string | null
  publisher: string | null
  isbn: string | null
  tags: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  user_id: string | null
  video_url: string | null
  video_file_url: string | null
  video_title: string | null
  video_description: string | null
}

const BOOKS_PER_PAGE = 12

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [totalBooks, setTotalBooks] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid")

  const totalPages = Math.max(1, Math.ceil(totalBooks / BOOKS_PER_PAGE))

  const fetchBooks = async (page: number = 1) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/books?page=${page}&pageSize=${BOOKS_PER_PAGE}`, {
        cache: "no-store",
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to fetch books")
      }

      setBooks(result.books || [])
      setTotalBooks(Number(result.total || 0))
    } catch (error) {
      console.error("Error fetching books:", error)
      setBooks([])
      setTotalBooks(0)
    } finally {
      setIsLoading(false)
    }
  }

  const handleBookDeleted = () => {
    const newTotalBooks = totalBooks - 1
    const newTotalPages = Math.max(1, Math.ceil(Math.max(newTotalBooks, 0) / BOOKS_PER_PAGE))
    const nextPage = Math.min(currentPage, newTotalPages)
    setCurrentPage(nextPage)
    fetchBooks(nextPage)
  }

  const handlePageChange = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages)
    setCurrentPage(nextPage)
    fetchBooks(nextPage)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  useEffect(() => {
    fetchBooks(currentPage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                variant={viewMode === "grid" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("grid")}
                className="h-8 w-8 p-0"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                onClick={() => setViewMode("list")}
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="text-base text-muted-foreground">
            {totalBooks} {totalBooks === 1 ? "book" : "books"} total
            {totalBooks > 0 && totalPages > 1 && (
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
                <div className="bg-muted rounded-lg h-80" />
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
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {books.map((book) => (
                  <BookCard
                    key={book.id}
                    book={book}
                    onBookDeleted={handleBookDeleted}
                    canEdit={true}
                    showEdit={false}
                    isAuthenticated={true}
                  />
                ))}
              </div>
            ) : (
              <div className="bg-card border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted border-b">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-sm">Book</th>
                      <th className="text-left px-4 py-3 font-semibold text-sm">Details</th>
                      <th className="text-left px-4 py-3 font-semibold text-sm">Tags</th>
                      <th className="text-center px-4 py-3 font-semibold text-sm">Created</th>
                      <th className="text-center px-4 py-3 font-semibold text-sm">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {books.map((book) => (
                      <tr key={book.id} className="border-b hover:bg-muted/50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href={`/books/${book.id}/reader`} className="flex items-center gap-3 hover:underline">
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
                            {book.author && <div>Author: {book.author}</div>}
                            {book.publisher && <div>Publisher: {book.publisher}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {book.tags && (
                            <div className="flex flex-wrap gap-1">
                              {book.tags
                                .split(/[,]+/)
                                .slice(0, 2)
                                .map((tag, index) => {
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
                          {book.created_at ? new Date(book.created_at).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            {book.file_url && (
                              <Link href={`/books/${book.id}/reader`}>
                                <Button variant="outline" size="sm">
                                  Read
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

            {totalPages > 1 && (
              <div className="flex items-center justify-center space-x-2 mt-8">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1}>
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
