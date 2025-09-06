"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
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
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    book_id: "",
    tags: "",
    category: "",
  })

  useEffect(() => {
    fetchBooks()
  }, [])

  const fetchBooks = async () => {
    try {
      const { data, error } = await supabase.from("Booklist").select("id, title").order("title")

      if (error) throw error
      setBooks(data || [])
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
      router.push(`/notes/${data.id}`)
    } catch (error) {
      console.error("Error creating note:", error)
      toast.error("Failed to create study note")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" asChild>
          <Link href="/notes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Notes
          </Link>
        </Button>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Create New Study Note</CardTitle>
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
              <Label htmlFor="book">Related Book (Optional)</Label>
              <Select value={formData.book_id} onValueChange={(value) => setFormData({ ...formData, book_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a book" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No book selected</SelectItem>
                  {books.map((book) => (
                    <SelectItem key={book.id} value={book.id.toString()}>
                      {book.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Link href="/notes">Cancel</Link>
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
