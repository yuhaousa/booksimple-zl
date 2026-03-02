"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Book as BookIcon,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Pencil,
  Star,
  Trash2,
} from "lucide-react"

import { useAuth } from "@/hooks/use-auth"
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

function parseTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function BooksPage() {
  const { user } = useAuth()
  const [books, setBooks] = useState<Book[]>([])
  const [totalBooks, setTotalBooks] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [deletingBookId, setDeletingBookId] = useState<number | null>(null)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(totalBooks / BOOKS_PER_PAGE)), [totalBooks])

  const fetchBooks = useCallback(async (page: number = 1) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/books?page=${page}&pageSize=${BOOKS_PER_PAGE}`, {
        cache: "no-store",
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to fetch books")
      }

      setBooks((result.books || []) as Book[])
      setTotalBooks(Number(result.total || 0))
    } catch (error) {
      console.error("Error fetching books:", error)
      setBooks([])
      setTotalBooks(0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const handlePageChange = (page: number) => {
    const nextPage = Math.min(Math.max(page, 1), totalPages)
    if (nextPage === currentPage) return
    setCurrentPage(nextPage)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  useEffect(() => {
    void fetchBooks(currentPage)
  }, [currentPage, fetchBooks])

  const handleDeleteBook = async (book: Book) => {
    if (!confirm(`Are you sure you want to delete "${book.title || "this book"}"?`)) return

    setDeletingBookId(book.id)
    try {
      const response = await fetch(`/api/books/${book.id}`, { method: "DELETE" })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to delete book")
      }

      const nextTotal = Math.max(totalBooks - 1, 0)
      setBooks((prev) => prev.filter((entry) => entry.id !== book.id))
      setTotalBooks(nextTotal)
      const maxPageAfterDelete = Math.max(1, Math.ceil(nextTotal / BOOKS_PER_PAGE))
      if (currentPage > maxPageAfterDelete) {
        setCurrentPage(maxPageAfterDelete)
      }
    } catch (error) {
      console.error("Error deleting book:", error)
      alert("Failed to delete book.")
    } finally {
      setDeletingBookId(null)
    }
  }

  const rankedBooks = useMemo(() => {
    return [...books].sort((a, b) => parseTimestamp(b.created_at) - parseTimestamp(a.created_at))
  }, [books])

  const rankedColumns = useMemo(() => {
    if (rankedBooks.length === 0) return [] as Array<Array<{ book: Book; rank: number }>>

    const rowsPerColumn = Math.max(1, Math.ceil(rankedBooks.length / 3))
    const baseRank = (currentPage - 1) * BOOKS_PER_PAGE

    return Array.from({ length: 3 }, (_, columnIndex) =>
      rankedBooks
        .slice(columnIndex * rowsPerColumn, (columnIndex + 1) * rowsPerColumn)
        .map((book, rowIndex) => ({
          book,
          rank: baseRank + columnIndex * rowsPerColumn + rowIndex + 1,
        }))
    ).filter((column) => column.length > 0)
  }, [currentPage, rankedBooks])

  const pageNumbers = useMemo(() => {
    return Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
      if (totalPages <= 5) return i + 1
      if (currentPage <= 3) return i + 1
      if (currentPage >= totalPages - 2) return totalPages - 4 + i
      return currentPage - 2 + i
    })
  }, [currentPage, totalPages])

  return (
    <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)] text-[#2c3e30]">
      <header className="border-b border-[#b2cebb66] bg-white/60 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2d5038] text-balance">Book Collection</h1>
          <p className="text-base md:text-lg text-[#5d7766] mt-2">Browse and manage your personal library</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl md:text-2xl font-semibold text-[#2c3e30]">All Books</h2>
          <div className="text-sm md:text-base text-[#5d7766]">
            {totalBooks} {totalBooks === 1 ? "book" : "books"} total
            {totalBooks > 0 && totalPages > 1 && (
              <span className="ml-2">
                (Page {currentPage} of {totalPages})
              </span>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-6 p-1 md:p-0">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <div key={index} className="h-40 rounded-xl bg-[#d6e8dc] animate-pulse" />
              ))}
            </div>
          </div>
        ) : totalBooks === 0 ? (
          <div className="p-10 text-center">
            <BookIcon className="mx-auto h-10 w-10 text-[#7aaa87]" />
            <p className="mt-3 text-[#4d6655]">No books in your collection yet.</p>
          </div>
        ) : (
          <>
            <section className="p-1 md:p-0">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {rankedColumns.map((column, columnIndex) => (
                  <div key={`column-${columnIndex}`} className="space-y-3">
                    {column.map(({ book, rank }) => {
                      const shelfLabel = book.tags?.split(",")[0]?.trim() || book.publisher || "General"
                      const isOwner = Boolean(user?.id && book.user_id === user.id)
                      return (
                        <div
                          key={book.id}
                          className="flex items-stretch gap-3 rounded-xl border border-[#b2cebb66] bg-white/75 p-3 shadow-[0_4px_14px_rgba(74,124,90,0.08)]"
                        >
                          <span className="mt-2 w-5 text-center text-sm font-semibold text-[#5d7766]">{rank}</span>

                          <Link
                            href={`/books/${book.id}/reader`}
                            className="relative h-[184px] w-[128px] shrink-0 overflow-hidden rounded-md"
                          >
                            <Image
                              src={book.cover_url || "/abstract-book-cover.png"}
                              alt={book.title || "Book cover"}
                              fill
                              className="object-cover"
                              sizes="128px"
                            />
                          </Link>

                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/books/${book.id}/reader`}
                              className="line-clamp-2 text-sm font-semibold text-[#2c3e30] hover:text-[#2d5038]"
                            >
                              {book.title || "Untitled"}
                            </Link>
                            <p className="mt-0.5 line-clamp-1 text-sm text-[#4d6655]">{book.author || "Unknown Author"}</p>
                            <p className="mt-0.5 line-clamp-1 text-xs text-[#6f8d7a]">{shelfLabel}</p>
                            <div className="mt-1 flex items-center gap-2 text-xs text-[#5d7766]">
                              <span className="inline-flex items-center gap-1">
                                <Star className="h-3.5 w-3.5" />
                                {((book.id % 8) * 0.1 + 3.8).toFixed(1)}
                              </span>
                            </div>
                          </div>

                          <div className="ml-auto flex h-[184px] flex-col items-end justify-end gap-2">
                            <Link
                              href={`/books/${book.id}`}
                              className="inline-flex items-center gap-1 rounded-md border border-[#b2cebb80] bg-white px-2 py-1 text-xs text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Preview
                            </Link>

                            {isOwner && (
                              <Link
                                href={`/books/${book.id}/edit`}
                                className="inline-flex items-center gap-1 rounded-md border border-[#b2cebb80] bg-white px-2 py-1 text-xs text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                                aria-label={`Edit ${book.title || "book"}`}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                                Edit
                              </Link>
                            )}

                            {book.file_url && (
                              <Link href={`/books/${book.id}/reader`}>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="border-[#b2cebb80] bg-white/80 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                                >
                                  Read
                                </Button>
                              </Link>
                            )}

                            {isOwner && (
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 px-2 text-xs"
                                onClick={() => void handleDeleteBook(book)}
                                disabled={deletingBookId === book.id}
                              >
                                <Trash2 className="mr-1 h-3.5 w-3.5" />
                                {deletingBookId === book.id ? "Deleting..." : "Delete"}
                              </Button>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </section>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#b2cebb80] bg-white/80 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#b2cebb80] bg-white/80 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                <div className="flex items-center space-x-1">
                  {pageNumbers.map((pageNumber) => (
                    <Button
                      key={pageNumber}
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(pageNumber)}
                      className={`min-w-[2.5rem] ${
                        currentPage === pageNumber
                          ? "border-[#4a7c5a] bg-[#4a7c5a] text-white hover:bg-[#2d5038]"
                          : "border-[#b2cebb80] bg-white/80 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                      }`}
                    >
                      {pageNumber}
                    </Button>
                  ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#b2cebb80] bg-white/80 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  className="border-[#b2cebb80] bg-white/80 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
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
