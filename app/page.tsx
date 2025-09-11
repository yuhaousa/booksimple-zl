"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import BannerCarousel from "@/components/banner-carousel"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen } from "lucide-react"

interface Book {
  id: number
  title: string
  author: string | null
  description: string | null
  cover_url: string | null
  year: number | null
  created_at: string
  user_id: string // <-- must be present
}

export default function HomePage() {
  const [latestBooks, setLatestBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatestBooks()
  }, [])

  const fetchLatestBooks = async () => {
    try {
      const { data, error } = await supabase
        .from("Booklist")
        .select("id, title, author, user_id, description, cover_url, year, created_at") // include user_id
        .order("created_at", { ascending: false })
        .limit(4)

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
        })
      )

      setLatestBooks(booksWithSignedUrls)
    } catch (error) {
      console.error("Error fetching latest books:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <BannerCarousel />
      </div>

      <div className="container mx-auto px-4 py-16">
        <div className="text-center space-y-6">
          <h1 className="text-4xl font-bold text-primary text-balance">Welcome to BookList</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
            Your personal digital library management system. Organize, track, and discover your book collection with
            ease.
          </p>

          {/* Latest Books Section */}
          <div className="mt-16 mb-12">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold text-foreground">Latest Additions</h2>
              <Button variant="outline" asChild>
                <Link href="/books">
                  View All Books
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted rounded-lg h-64 mb-3"></div>
                    <div className="bg-muted rounded h-4 mb-2"></div>
                    <div className="bg-muted rounded h-3 w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : latestBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {latestBooks.map((book) => (
                  <Card key={book.id} className="group hover:shadow-lg transition-shadow duration-200 border-border">
                    <CardContent className="p-4">
                      <Link href={`/books/${book.id}`}>
                        <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                          <Image
                            src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                            alt={book.title || "Book cover"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder.svg?height=400&width=300&query=book+cover"
                            }}
                          />
                        </div>
                      </Link>

                      <div className="space-y-2">
                        <Link href={`/books/${book.id}`}>
                          <h3 className="font-semibold text-foreground line-clamp-2 text-balance hover:text-primary transition-colors cursor-pointer text-left">
                            {book.title || "Untitled"}
                          </h3>
                        </Link>
                        <p className="text-sm text-muted-foreground text-left">{book.author || "Unknown Author"}</p>
                        {book.description && (
                          <p className="text-xs text-muted-foreground text-left line-clamp-2">{book.description}</p>
                        )}
                        {book.year && <p className="text-xs text-muted-foreground text-left">Published: {book.year}</p>}
                        {book.created_at && (
                          <p className="text-xs text-muted-foreground text-left">
                            Added: {new Date(book.created_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/50 rounded-lg">
                <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No books yet</h3>
                <p className="text-muted-foreground mb-4">Start building your library by adding your first book</p>
                <Button asChild>
                  <Link href="/upload">Add Your First Book</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mt-12">
            <div className="bg-card border rounded-lg p-6 space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Browse Your Collection</h3>
              <p className="text-muted-foreground text-sm">
                View all your books in an organized, searchable format with cover images and detailed information.
              </p>
            </div>

            <div className="bg-card border rounded-lg p-6 space-y-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold">Add New Books</h3>
              <p className="text-muted-foreground text-sm">
                Easily add new books to your collection with detailed metadata including author, publisher, and tags.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
