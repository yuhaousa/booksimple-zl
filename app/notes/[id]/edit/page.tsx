"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, Upload, ImageIcon } from "lucide-react"
import { toast } from "sonner"

interface Book {
  id: number
  title: string
  author: string | null
  description: string | null
  publisher: string | null
  year: number | null
  isbn: string | null
  tags: string | null
  cover_url: string | null
  file_url: string | null
}

export default function BookEditPage() {
  const params = useParams()
  const router = useRouter()
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string>("")

  // Add debug logging
  console.log("Edit page params:", params)
  console.log("Book ID:", params.id)

  useEffect(() => {
    console.log("useEffect triggered, params:", params)
    if (params.id) {
      console.log("Fetching book with ID:", params.id)
      fetchBook()
    } else {
      console.log("No ID found in params, redirecting...")
      router.push("/books")
    }
  }, [params.id])

  const fetchBook = async () => {
    try {
      console.log("Starting fetchBook with ID:", params.id)
      const { data, error } = await supabase
        .from("Booklist")
        .select("*")
        .eq("id", params.id)
        .single()

      console.log("Supabase response:", { data, error })

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      if (!data) {
        console.log("No book data found")
        throw new Error("Book not found")
      }

      // Generate signed URL for cover if it exists
      let coverUrl = data.cover_url
      if (coverUrl) {
        const { data: signedCover, error: coverError } = await supabase.storage
          .from("book-cover")
          .createSignedUrl(coverUrl.replace(/^book-cover\//, ""), 60 * 60 * 24)
        if (!coverError && signedCover?.signedUrl) {
          coverUrl = signedCover.signedUrl
        }
      }

      console.log("Book loaded successfully:", data)
      setBook({ ...data, cover_url: coverUrl })
      setCoverPreview(coverUrl || "")
    } catch (error) {
      console.error("Error fetching book:", error)
      toast.error("Failed to load book details")
      // Comment out the redirect for debugging
      // router.push("/books")
    } finally {
      setLoading(false)
    }
  }

  const handleCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB")
      return
    }

    setCoverFile(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setCoverPreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const uploadCoverImage = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("book-cover")
        .upload(filePath, file)

      if (uploadError) throw uploadError

      return `book-cover/${filePath}`
    } catch (error) {
      console.error("Error uploading cover:", error)
      throw error
    }
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!book) return

    setSaving(true)

    try {
      const formData = new FormData(event.currentTarget)
      let coverPath = book.cover_url

      // Upload new cover if selected
      if (coverFile) {
        coverPath = await uploadCoverImage(coverFile)
      }

      // Prepare update data
      const updateData = {
        title: formData.get("title") as string,
        author: formData.get("author") as string || null,
        description: formData.get("description") as string || null,
        publisher: formData.get("publisher") as string || null,
        year: formData.get("year") ? parseInt(formData.get("year") as string) : null,
        isbn: formData.get("isbn") as string || null,
        tags: formData.get("tags") as string || null,
        cover_url: coverPath,
      }

      const { error } = await supabase
        .from("Booklist")
        .update(updateData)
        .eq("id", book.id)

      if (error) throw error

      toast.success("Book updated successfully!")
      router.push(`/books/${book.id}`) // Navigate to book detail instead of listing
    } catch (error) {
      console.error("Error updating book:", error)
      toast.error("Failed to update book. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-primary">Edit Book</h1>
            <p className="text-muted-foreground mt-2">Update your book information</p>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                <p className="text-muted-foreground">Loading book details...</p>
                <p className="text-sm text-muted-foreground mt-2">Book ID: {params.id}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-card">
          <div className="container mx-auto px-4 py-6">
            <h1 className="text-3xl font-bold text-primary">Edit Book</h1>
            <p className="text-muted-foreground mt-2">Update your book information</p>
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <div className="max-w-2xl mx-auto">
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Book not found</h3>
              <p className="text-sm text-muted-foreground mb-4">Book ID: {params.id}</p>
              <Button asChild>
                <Link href="/books">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Books
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-4 mb-2">
            <Link href={`/books/${book.id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Book
              </Button>
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-primary">Edit Book</h1>
          <p className="text-muted-foreground mt-2">Update your book information</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Book Information</CardTitle>
              <CardDescription>Update the details of your book</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Book Cover Upload */}
                <div className="space-y-2">
                  <Label htmlFor="cover">Book Cover</Label>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-32 h-40 bg-muted border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center overflow-hidden">
                        {coverPreview ? (
                          <Image
                            src={coverPreview}
                            alt="Cover preview"
                            width={128}
                            height={160}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="text-center">
                            <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground" />
                            <p className="mt-1 text-sm text-muted-foreground">No cover</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <Input
                        id="cover"
                        type="file"
                        accept="image/*"
                        onChange={handleCoverChange}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                      />
                      <p className="mt-1 text-sm text-muted-foreground">
                        Upload a cover image for your book. Accepted formats: JPG, PNG, GIF (max 10MB)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Book Title */}
                <div className="space-y-2">
                  <Label htmlFor="title">Book Title *</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={book.title}
                    placeholder="Enter the book title"
                    required
                  />
                </div>

                {/* Author */}
                <div className="space-y-2">
                  <Label htmlFor="author">Author</Label>
                  <Input
                    id="author"
                    name="author"
                    defaultValue={book.author || ""}
                    placeholder="Enter the author's name"
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={book.description || ""}
                    placeholder="Enter a brief description of the book"
                    rows={4}
                  />
                </div>

                {/* Publisher and Year */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="publisher">Publisher</Label>
                    <Input
                      id="publisher"
                      name="publisher"
                      defaultValue={book.publisher || ""}
                      placeholder="Enter the publisher"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year">Publication Year</Label>
                    <Input
                      id="year"
                      name="year"
                      type="number"
                      defaultValue={book.year || ""}
                      placeholder="Enter the publication year"
                      min="1000"
                      max={new Date().getFullYear()}
                    />
                  </div>
                </div>

                {/* ISBN */}
                <div className="space-y-2">
                  <Label htmlFor="isbn">ISBN</Label>
                  <Input
                    id="isbn"
                    name="isbn"
                    defaultValue={book.isbn || ""}
                    placeholder="Enter the ISBN"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    name="tags"
                    defaultValue={book.tags || ""}
                    placeholder="Enter tags separated by commas (e.g., fiction, mystery, thriller)"
                  />
                  <p className="text-sm text-muted-foreground">
                    Separate multiple tags with commas to help categorize your book
                  </p>
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-end space-x-2">
                  <Button type="button" variant="outline" asChild>
                    <Link href={`/books/${book.id}`}>Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-foreground mr-2"></div>
                        Updating Book...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        Update Book
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
