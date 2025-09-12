"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { Search, BookOpen, MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Image from "next/image"
import Link from "next/link"

interface Book {
  id: number
  title: string
  author: string | null
  description: string | null
  cover_url: string | null
  year: number | null
  created_at: string
  user_id: string
}

export default function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchBooks()
  }, [])

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase.from("Booklist").select("*").order("created_at", { ascending: false })

      if (error) throw error

      // Generate signed URLs for covers
      const booksWithSignedUrls = await Promise.all(
        (data || []).map(async (book) => {
          let coverUrl = book.cover_url

          if (coverUrl) {
            const { data: signedCover, error: coverError } = await supabase.storage
              .from("book-cover")
              .createSignedUrl(coverUrl.replace(/^book-cover\//, ""), 60 * 60 * 24)
            if (!coverError && signedCover?.signedUrl) {
              coverUrl = signedCover.signedUrl
            }
          }

          return { ...book, cover_url: coverUrl }
        }),
      )

      setBooks(booksWithSignedUrls)
    } catch (error) {
      console.error("Error fetching books:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteBook = async (bookId: number) => {
    if (!confirm("Are you sure you want to delete this book?")) return

    try {
      const { error } = await supabase.from("Booklist").delete().eq("id", bookId)

      if (error) throw error

      setBooks(books.filter((book) => book.id !== bookId))
    } catch (error) {
      console.error("Error deleting book:", error)
    }
  }

  const filteredBooks = books.filter(
    (book) =>
      book.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Book Management</h1>
          <p className="text-muted-foreground mt-2">View and manage all books in the system</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <BookOpen className="h-3 w-3 mr-1" />
          {books.length} Total Books
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search books..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border rounded-lg p-4 animate-pulse">
                  <div className="aspect-[3/4] bg-muted rounded-md mb-3"></div>
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-3 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredBooks.map((book) => (
                <div key={book.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="aspect-[3/4] relative mb-3 bg-muted rounded-md overflow-hidden">
                    <Image
                      src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                      alt={book.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    />
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-semibold text-foreground line-clamp-2 text-balance">{book.title}</h3>
                    <p className="text-sm text-muted-foreground">{book.author || "Unknown Author"}</p>
                    {book.year && <p className="text-xs text-muted-foreground">Published: {book.year}</p>}
                    <div className="flex items-center justify-between pt-2">
                      <Badge variant="outline" className="text-xs">
                        User: {book.user_id.slice(0, 8)}...
                      </Badge>

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
                          <DropdownMenuItem
                            onClick={() => handleDeleteBook(book.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Book
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              ))}
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
