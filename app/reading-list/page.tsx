"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BookOpen,
  Trash2,
  Calendar,
  User,
  Eye,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Lightbulb,
  BookMarked,
  CheckCircle2,
  Clock,
} from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"

interface ReadingListItem {
  id: number
  book_id: number
  added_at: string
  status: "to_read" | "reading" | "completed"
  book: {
    id: number
    title: string
    author: string | null
    publisher: string | null
    year: number | null
    cover_url: string | null
    file_url: string | null
    description: string | null
    tags: string | null
    user_id?: string
  }
}

const STATUS_CONFIG = {
  to_read: { label: "To Read", icon: Clock, color: "bg-amber-100 text-amber-700 border-amber-200" },
  reading: { label: "Reading", icon: BookOpen, color: "bg-blue-100 text-blue-700 border-blue-200" },
  completed: { label: "Completed", icon: CheckCircle2, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
} as const

const FILTER_CONFIG = [
  { key: "all", label: "All" },
  { key: "to_read", label: "To Read" },
  { key: "reading", label: "Reading" },
  { key: "completed", label: "Completed" },
] as const

const ITEMS_PER_PAGE = 12

export default function ReadingListPage() {
  const { user, loading: authLoading } = useAuth()
  const [readingList, setReadingList] = useState<ReadingListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "to_read" | "reading" | "completed">("all")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    const fetchList = async () => {
      if (authLoading) return
      if (!user) { setLoading(false); return }
      try {
        const response = await fetch("/api/reading-list", {
          cache: "no-store",
          headers: { "x-user-id": user.id },
        })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.success) {
          throw new Error(result?.details || result?.error || "Failed to fetch reading list")
        }
        setReadingList((result.items || []) as ReadingListItem[])
      } catch (error) {
        console.error("Error fetching reading list:", error)
        toast.error("Failed to load reading list")
      } finally {
        setLoading(false)
      }
    }
    fetchList()
  }, [user, authLoading])

  const removeFromReadingList = async (itemId: number) => {
    if (!confirm("Remove this book from your reading list?")) return
    if (!user) { toast.error("Please log in first"); return }
    try {
      const response = await fetch(`/api/reading-list?id=${itemId}`, {
        method: "DELETE",
        headers: { "x-user-id": user.id },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to delete reading-list item")
      }
      toast.success("Book removed from reading list")
      setReadingList((prev) => prev.filter((item) => item.id !== itemId))
    } catch (error) {
      console.error("Error removing from reading list:", error)
      toast.error("Failed to remove book from reading list")
    }
  }

  const updateStatus = async (itemId: number, newStatus: ReadingListItem["status"]) => {
    if (!user) { toast.error("Please log in first"); return }
    try {
      const response = await fetch("/api/reading-list", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-user-id": user.id },
        body: JSON.stringify({ id: itemId, status: newStatus }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to update status")
      }
      toast.success(`Marked as ${STATUS_CONFIG[newStatus].label}`)
      setReadingList((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, status: newStatus } : item)),
      )
    } catch (error) {
      console.error("Error updating status:", error)
      toast.error("Failed to update status")
    }
  }

  const filteredList = readingList.filter((item) => filter === "all" || item.status === filter)
  const totalItems = filteredList.length
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedList = filteredList.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter)
    setCurrentPage(1)
  }

  const statusCounts = {
    all: readingList.length,
    to_read: readingList.filter((i) => i.status === "to_read").length,
    reading: readingList.filter((i) => i.status === "reading").length,
    completed: readingList.filter((i) => i.status === "completed").length,
  }

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4a7c5a] mx-auto mb-4" />
          <p className="text-[#4d6655]">{authLoading ? "Checking login status…" : "Loading your reading list…"}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)] flex items-center justify-center">
        <div className="text-center">
          <BookMarked className="h-12 w-12 text-[#7aaa87] mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-[#2d4a35] mb-2">Please log in to view your reading list</h3>
          <Button asChild className="bg-[#4a7c5a] hover:bg-[#3a6449] text-white">
            <Link href="/login">Login</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)]">
      {/* Header */}
      <header className="border-b border-[#b2cebb66] bg-white/60 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#2d4a35]">My Reading List</h1>
            <p className="text-sm text-[#5a7a63] mt-0.5">Track your reading progress</p>
          </div>
          <Button variant="outline" asChild className="border-[#b2cebb] text-[#4a7c5a] hover:bg-[#eef5f0]">
            <Link href="/reading-list/suggested">
              <Lightbulb className="w-4 h-4 mr-2" />
              Suggested Reading
            </Link>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 md:py-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {FILTER_CONFIG.map(({ key, label }) => {
            const count = statusCounts[key as keyof typeof statusCounts]
            const isActive = filter === key
            return (
              <button
                key={key}
                onClick={() => handleFilterChange(key as typeof filter)}
                className={`rounded-xl px-4 py-3 text-left transition-all border ${
                  isActive
                    ? "bg-[#4a7c5a] text-white border-[#4a7c5a] shadow-md"
                    : "bg-white/70 text-[#4d6655] border-[#b2cebb66] hover:bg-white/90 hover:border-[#b2cebb]"
                }`}
              >
                <div className={`text-2xl font-bold ${isActive ? "text-white" : "text-[#2d4a35]"}`}>{count}</div>
                <div className={`text-xs mt-0.5 ${isActive ? "text-white/80" : "text-[#7aaa87]"}`}>{label}</div>
              </button>
            )
          })}
        </div>

        {/* Book grid */}
        {totalItems === 0 ? (
          <div className="bg-white/70 rounded-2xl border border-[#b2cebb66] text-center py-16 px-4">
            <BookMarked className="h-12 w-12 text-[#7aaa87] mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-[#2d4a35] mb-2">
              {filter === "all" ? "Your reading list is empty" : `No books marked as "${STATUS_CONFIG[filter as Exclude<typeof filter,"all">]?.label}"`}
            </h3>
            <p className="text-sm text-[#5a7a63] mb-5">
              {filter === "all" ? "Add books from the library to start tracking your reading" : "Books with this status will appear here"}
            </p>
            <Button asChild className="bg-[#4a7c5a] hover:bg-[#3a6449] text-white">
              <Link href="/books">Browse Books</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {paginatedList.map((item) => {
              const statusCfg = STATUS_CONFIG[item.status]
              const StatusIcon = statusCfg.icon
              const isOwner = Boolean(user?.id && item.book.user_id === user.id)
              return (
                <div
                  key={item.id}
                  className="group bg-white/75 rounded-xl border border-[#b2cebb66] overflow-hidden shadow-[0_4px_14px_rgba(74,124,90,0.08)] hover:shadow-[0_8px_24px_rgba(74,124,90,0.15)] transition-all duration-200"
                >
                  {/* Cover */}
                  <div className="aspect-[3/4] relative bg-[#eef5f0]">
                    <Image
                      src={item.book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                      alt={item.book.title || "Book cover"}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        e.currentTarget.src = "/abstract-book-cover.png"
                      }}
                    />
                    {/* Status pill */}
                    <div className="absolute top-2 left-2">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${statusCfg.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3 space-y-3">
                    <div>
                      <Link
                        href={`/books/${item.book.id}`}
                        className="font-semibold text-sm text-[#2d4a35] line-clamp-2 hover:text-[#4a7c5a] transition-colors leading-snug"
                      >
                        {item.book.title || "Untitled"}
                      </Link>
                      {item.book.author && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-[#7aaa87]">
                          <User className="w-3 h-3 flex-shrink-0" />
                          <span className="line-clamp-1">{item.book.author}</span>
                        </div>
                      )}
                      {item.book.publisher && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[#6f8d7a]">{item.book.publisher}</p>
                      )}
                      {item.book.description && (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-[#5d7766]">{item.book.description.trim()}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 text-xs text-[#a0b8a7]">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>{new Date(item.added_at).toLocaleDateString()}</span>
                    </div>

                    {item.book.tags && (
                      <div className="flex flex-wrap gap-1">
                        {item.book.tags.split(",").slice(0, 3).map((tag, i) => (
                          <span key={i} className="rounded-full bg-[#d6e8dc] px-2 py-0.5 text-xs text-[#4a7c5a]">
                            {tag.trim()}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#b2cebb66] pt-3">
                      <Link
                        href={`/books/${item.book.id}`}
                        className="inline-flex items-center gap-1 rounded-md border border-[#b2cebb80] bg-white px-2 py-1 text-xs text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Preview
                      </Link>

                      {isOwner && (
                        <Link
                          href={`/books/${item.book.id}/edit`}
                          className="inline-flex items-center gap-1 rounded-md border border-[#b2cebb80] bg-white px-2 py-1 text-xs text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                          aria-label={`Edit ${item.book.title || "book"}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                      )}

                      {item.book.file_url && (
                        <Link href={`/books/${item.book.id}/reader`}>
                          <Button variant="outline" size="sm" className="cursor-pointer border-[#b2cebb80] bg-white/80 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]">
                            Read
                          </Button>
                        </Link>
                      )}

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="h-8 px-2 text-xs cursor-pointer"
                        onClick={() => removeFromReadingList(item.id)}
                      >
                        <Trash2 className="mr-1 h-3.5 w-3.5" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <p className="text-sm text-[#5a7a63]">
              {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)} of {totalItems} books
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" onClick={() => handlePageChange(1)} disabled={currentPage === 1} className="border-[#b2cebb] text-[#4a7c5a] hover:bg-[#eef5f0]">
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1} className="border-[#b2cebb] text-[#4a7c5a] hover:bg-[#eef5f0]">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNumber: number
                if (totalPages <= 5) pageNumber = i + 1
                else if (currentPage <= 3) pageNumber = i + 1
                else if (currentPage >= totalPages - 2) pageNumber = totalPages - 4 + i
                else pageNumber = currentPage - 2 + i
                return (
                  <Button
                    key={pageNumber}
                    variant={currentPage === pageNumber ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    className={`min-w-[2.25rem] ${currentPage === pageNumber ? "bg-[#4a7c5a] hover:bg-[#3a6449] border-[#4a7c5a]" : "border-[#b2cebb] text-[#4a7c5a] hover:bg-[#eef5f0]"}`}
                  >
                    {pageNumber}
                  </Button>
                )
              })}
              <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages} className="border-[#b2cebb] text-[#4a7c5a] hover:bg-[#eef5f0]">
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => handlePageChange(totalPages)} disabled={currentPage === totalPages} className="border-[#b2cebb] text-[#4a7c5a] hover:bg-[#eef5f0]">
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
