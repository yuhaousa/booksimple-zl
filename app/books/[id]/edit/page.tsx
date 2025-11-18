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
import { ArrowLeft, Save, ImageIcon, FileText, Upload } from "lucide-react"
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
  video_url: string | null
  video_file_url: string | null
  video_title: string | null
  video_description: string | null
}

export default function BookEditPage() {
  const params = useParams()
  const router = useRouter()
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [coverPreview, setCoverPreview] = useState<string>("")
  const [pdfFile, setPdfFile] = useState<File | null>(null)
  const [pdfFileName, setPdfFileName] = useState<string>("")

  useEffect(() => {
    if (params.id) {
      fetchBook()
    }
  }, [params.id])

  const fetchBook = async () => {
    try {
      const bookId = Array.isArray(params.id) ? params.id[0] : params.id
      
      const { data, error } = await supabase
        .from("Booklist")
        .select("*")
        .eq("id", bookId)
        .single()

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      if (!data) {
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

      setBook({ ...data, cover_url: coverUrl })
      setCoverPreview(coverUrl || "")
      
      // Set current PDF file name if exists
      if (data.file_url) {
        const fileName = data.file_url.split('/').pop() || 'Current PDF file'
        setPdfFileName(fileName)
      }
    } catch (error) {
      console.error("Error fetching book:", error)
      toast.error("Failed to load book details")
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

  const handlePdfChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (file.type !== "application/pdf") {
      toast.error("Please select a PDF file")
      return
    }

    // Validate file size (100MB limit for PDFs)
    if (file.size > 100 * 1024 * 1024) {
      toast.error("PDF file size must be less than 100MB")
      return
    }

    setPdfFile(file)
    setPdfFileName(file.name)
    toast.success("PDF file selected successfully")
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

  const uploadPdfFile = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split(".").pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `${fileName}`

      const { error: uploadError } = await supabase.storage
        .from("book-file")
        .upload(filePath, file)

      if (uploadError) throw uploadError

      return `book-file/${filePath}`
    } catch (error) {
      console.error("Error uploading PDF:", error)
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
      let filePath = book.file_url

      // Upload new cover if selected
      if (coverFile) {
        coverPath = await uploadCoverImage(coverFile)
      }

      // Upload new PDF if selected
      if (pdfFile) {
        filePath = await uploadPdfFile(pdfFile)
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
        file_url: filePath,
        video_url: formData.get("video_url") as string || null,
        video_title: formData.get("video_title") as string || null,
        video_description: formData.get("video_description") as string || null,
      }

      const { error } = await supabase
        .from("Booklist")
        .update(updateData)
        .eq("id", book.id)

      if (error) throw error

      const uploadedItems = []
      if (coverFile) uploadedItems.push("cover")
      if (pdfFile) uploadedItems.push("PDF")
      
      const message = uploadedItems.length > 0 
        ? `Book updated successfully! New ${uploadedItems.join(" and ")} uploaded.`
        : "Book updated successfully!"
      
      toast.success(message)
      router.push("/books")
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
              <p className="text-sm text-muted-foreground mb-4">The requested book could not be found.</p>
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
            <Link href="/books">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Books
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

                {/* PDF File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="pdf">PDF File</Label>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-32 h-20 bg-muted border-2 border-dashed border-muted-foreground/25 rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="mx-auto h-6 w-6 text-muted-foreground mb-1" />
                          <p className="text-xs text-muted-foreground">PDF File</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <Input
                        id="pdf"
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handlePdfChange}
                        className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/80"
                      />
                      <p className="mt-1 text-sm text-muted-foreground">
                        Upload a new PDF file to replace the current one. Accepted format: PDF (max 100MB)
                      </p>
                      {pdfFileName && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-muted rounded-md">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {pdfFile ? "New: " : "Current: "}{pdfFileName}
                          </span>
                          {pdfFile && (
                            <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                              Ready to upload
                            </span>
                          )}
                        </div>
                      )}
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

                {/* Video Section */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="text-lg font-semibold">Related Video (Optional)</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="video_url">Video URL</Label>
                    <Input
                      id="video_url"
                      name="video_url"
                      defaultValue={book.video_url || ""}
                      placeholder="Enter YouTube, Vimeo, or other video URL"
                      type="url"
                    />
                    <p className="text-sm text-muted-foreground">
                      Paste a link to a video related to this book (YouTube, Vimeo, etc.)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video_title">Video Title</Label>
                    <Input
                      id="video_title"
                      name="video_title"
                      defaultValue={book.video_title || ""}
                      placeholder="Enter video title"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video_description">Video Description</Label>
                    <Textarea
                      id="video_description"
                      name="video_description"
                      defaultValue={book.video_description || ""}
                      placeholder="Describe what the video is about"
                      rows={3}
                    />
                  </div>
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
                        {(coverFile || pdfFile) ? "Uploading Files..." : "Updating Book..."}
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
