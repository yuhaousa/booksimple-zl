"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import {
  Search,
  BookOpen,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  Download,
  ExternalLink,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

type Book = {
  id: number
  created_at: string
  updated_at?: string
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

async function fetchAllBooks() {
  const all: Book[] = []
  let page = 1
  let total = 0

  do {
    const response = await fetch(`/api/books?page=${page}&pageSize=50&includeAll=true`, { cache: "no-store" })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      throw new Error(result?.details || result?.error || "Failed to fetch books")
    }

    const batch = (result.books || []) as Book[]
    total = Number(result.total || 0)
    all.push(...batch)
    page += 1

    if (batch.length === 0) break
  } while (all.length < total)

  return all
}

export default function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    loadBooks()
  }, [])

  const loadBooks = async () => {
    setLoading(true)
    try {
      const allBooks = await fetchAllBooks()
      setBooks(allBooks)
    } catch (error) {
      console.error("Error fetching books:", error)
      setBooks([])
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBook = async (bookId: number) => {
    const book = books.find((entry) => entry.id === bookId)
    const title = book?.title || "this book"
    if (!confirm(`Are you sure you want to delete "${title}"? This action cannot be undone.`)) return

    try {
      const response = await fetch(`/api/books/${bookId}`, { method: "DELETE" })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to delete book")
      }

      setBooks((prev) => prev.filter((item) => item.id !== bookId))
      alert(`Book "${title}" deleted successfully.`)
    } catch (error) {
      console.error("Error deleting book:", error)
      alert(`Failed to delete "${title}".`)
    }
  }

  const filteredBooks = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    if (!query) return books

    return books.filter((book) => {
      const values = [book.title, book.author, book.publisher, book.tags]
      return values.some((value) => value?.toLowerCase().includes(query))
    })
  }, [books, searchTerm])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Book Management</h1>
          <p className="text-muted-foreground mt-2">Manage books stored in Cloudflare D1 and R2</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <BookOpen className="h-3 w-3 mr-1" />
          {books.length} Total Books
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by title, author, publisher, tags..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-48"></div>
                    <div className="h-3 bg-muted rounded w-32"></div>
                  </div>
                  <div className="h-8 bg-muted rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-foreground">Cover</th>
                    <th className="text-left p-4 font-medium text-foreground">Book Title</th>
                    <th className="text-left p-4 font-medium text-foreground">Author</th>
                    <th className="text-left p-4 font-medium text-foreground">Publisher</th>
                    <th className="text-left p-4 font-medium text-foreground">Updated</th>
                    <th className="text-left p-4 font-medium text-foreground">PDF</th>
                    <th className="text-left p-4 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map((book) => (
                    <tr key={book.id} className="border-b border-border/50 hover:bg-muted/50 transition-colors">
                      <td className="p-4">
                        <div className="w-12 h-16 relative bg-muted rounded overflow-hidden">
                          <Image
                            src={book.cover_url || "/placeholder.svg?height=80&width=60&query=book"}
                            alt={book.title || "Book cover"}
                            fill
                            className="object-cover"
                            sizes="60px"
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-foreground max-w-xs">{book.title || "Untitled"}</div>
                        {book.year && <div className="text-sm text-muted-foreground">Published: {book.year}</div>}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{book.author || "Unknown Author"}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{book.publisher || "Unknown Publisher"}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">
                          {new Date(book.updated_at || book.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(book.updated_at || book.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-4">
                        {book.file_url ? (
                          <button
                            onClick={() => window.open(book.file_url || "", "_blank")}
                            className="inline-flex items-center gap-1 text-[#4a7c5a] hover:text-[#2d5038] text-sm hover:underline cursor-pointer"
                          >
                            <Download className="h-4 w-4" />
                            Open PDF
                          </button>
                        ) : (
                          <span className="text-sm text-muted-foreground">No PDF</span>
                        )}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/books/${book.id}`} className="flex items-center">
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/books/${book.id}/edit`} className="flex items-center">
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Book
                              </Link>
                            </DropdownMenuItem>
                            {book.file_url && (
                              <DropdownMenuItem onClick={() => window.open(book.file_url || "", "_blank")}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open PDF
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteBook(book.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Book
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No books found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Try adjusting your search terms" : "No books have been added yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
