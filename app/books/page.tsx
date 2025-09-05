"use client"

import { useState, useEffect } from "react"
import { BookCard } from "@/components/book-card"
import { createClient, type Book } from "@/lib/supabase"
import { useRouter } from "next/navigation"

export default function BooksPage() {
  const [books, setBooks] = useState<Book[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase.from("Booklist").select("*").order("created_at", { ascending: false })

      if (error) throw error

      // Generate signed URLs for cover and file
      const booksWithSignedUrls = await Promise.all(
        (data || []).map(async (book) => {
          let coverUrl = book.cover_url
          let fileUrl = book.file_url

          // Only generate signed URL if file path exists
          if (coverUrl) {
            const { data: signedCover, error: coverError } = await supabase
              .storage
              .from("book-cover")
              .createSignedUrl(coverUrl.replace(/^book-cover\//, ""), 60 * 60 * 24)
            if (!coverError && signedCover?.signedUrl) {
              coverUrl = signedCover.signedUrl
            }
          }

          if (fileUrl) {
            const { data: signedFile, error: fileError } = await supabase
              .storage
              .from("book-file")
              .createSignedUrl(fileUrl.replace(/^book-file\//, ""), 60 * 60 * 24)
            if (!fileError && signedFile?.signedUrl) {
              fileUrl = signedFile.signedUrl
            }
          }

          return { ...book, cover_url: coverUrl, file_url: fileUrl }
        })
      )

      setBooks(booksWithSignedUrls)
    } catch (error) {
      console.error("Error fetching books:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchBooks()
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
            {books.length} {books.length === 1 ? "book" : "books"} total
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="bg-muted rounded-lg h-80"></div>
              </div>
            ))}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-muted-foreground text-lg mb-2">No books in your collection yet</div>
            <p className="text-sm text-muted-foreground">Add your first book using the upload page</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book) => (
              <div key={book.id} className="relative">
                <BookCard book={book} />
                <button
                  className="absolute top-2 right-2 bg-primary text-white px-3 py-1 rounded shadow hover:bg-primary/80"
                  onClick={() => router.push(`/books/edit/${book.id}`)}
                  aria-label="Edit book"
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
