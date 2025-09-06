"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"

interface Book {
  id: number
  title: string
}

export default function NewNotePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const bookId = searchParams.get('bookId')
  
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    book_id: null as string | null,
    tags: "",
    category: "",
  })

  useEffect(() => {
    fetchBooks()
  }, [])

  useEffect(() => {
    // Pre-select book if bookId is provided
    if (bookId && books.length > 0) {
      const book = books.find(b => b.id.toString() === bookId)
      if (book) {
        setSelectedBook(book)
        setFormData(prev => ({ ...prev, book_id: bookId }))
      }
    }
  }, [bookId, books])

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase.from("Booklist").select("id, title").order("title")

      if (error) throw error
      
      // Filter out any books with empty titles and log the data
      const validBooks = (data || []).filter(book => book.title && book.title.trim() !== '')
      console.log("Fetched books:", validBooks)
      setBooks(validBooks)
    } catch (error) {
      console.error("Error fetching books:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error("Please enter a title")
      return
    }

    setLoading(true)

    try {
      const noteData = {
        title: formData.title.trim(),
        content: formData.content.trim() || null,
        book_id: formData.book_id ? Number.parseInt(formData.book_id) : null,
        tags: formData.tags.trim() || null,
        category: formData.category.trim() || null,
      }

      const { data, error } = await supabase.from("study_notes").insert([noteData]).select().single()

      if (error) throw error

      toast.success("Study note created successfully")
      
      // If we came from a specific book, navigate back to that book
      if (bookId) {
        router.push(`/books/${bookId}`)
      } else {
        router.push(`/notes/${data.id}`)
      }
    } catch (error) {
      console.error("Error creating note:", error)
      toast.error("Failed to create study note")
    } finally {
      setLoading(false)
    }
  }

  const getBackLink = () => {
    if (bookId && selectedBook) {
      return `/books/${bookId}`
    }
    return "/notes"
  }

  const getBackText = () => {
    if (bookId && selectedBook) {
      return `Back to ${selectedBook.title}`
    }
    return "Back to Notes"
  }

  // Debug the current state
  console.log("Current formData.book_id:", formData.book_id, "type:", typeof formData.book_id)
  console.log("Books array:", books.map(b => ({ id: b.id, title: b.title })))

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" asChild>
          <Link href={getBackLink()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {getBackText()}
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>
            {selectedBook ? `Create Note for "${selectedBook.title}"` : "Create New Study Note"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter note title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                placeholder="Write your study notes here..."
                rows={10}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="book">Related Book {selectedBook ? "(Pre-selected)" : "(Optional)"}</Label>
              {selectedBook ? (
                <div className="flex items-center space-x-2">
                  <Input 
                    value={selectedBook.title} 
                    disabled 
                    className="bg-muted"
                  />
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setSelectedBook(null)
                      setFormData({ ...formData, book_id: null })
                    }}
                  >
                    Change
                  </Button>
                </div>
              ) : (
                <Select 
                  value={formData.book_id || undefined} 
                  onValueChange={(value) => {
                    console.log("Select onValueChange called with:", value, "type:", typeof value)
                    // Ensure we never set empty strings
                    if (value && value.trim() !== '') {
                      setFormData({ ...formData, book_id: value })
                    } else {
                      setFormData({ ...formData, book_id: null })
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a book" />
                  </SelectTrigger>
                  <SelectContent>
                    {books
                      .filter(book => book.id && book.title && book.title.trim() !== '')
                      .map((book) => {
                        const bookId = book.id.toString()
                        console.log("Rendering SelectItem with value:", bookId, "for book:", book.title)
                        return (
                          <SelectItem key={book.id} value={bookId}>
                            {book.title}
                          </SelectItem>
                        )
                      })}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Literature, Science, History"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                placeholder="Enter tags separated by commas"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" asChild>
                <Link href={getBackLink()}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Creating..." : "Create Note"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
