"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save, ImageIcon, FileText } from "lucide-react"
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

const formInputClass =
  "border-[#b2cebb80] bg-white/80 text-[#2c3e30] placeholder:text-[#6f8d7a] focus-visible:ring-[#7aaa87] focus-visible:ring-offset-0"

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

      const response = await fetch(`/api/books/${bookId}`, {
        cache: "no-store",
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success || !result?.book) {
        throw new Error("Book not found")
      }

      const data = result.book as Book
      setBook(data)
      setCoverPreview(data.cover_url || "")
      
      // Set current PDF file name if exists
      if (data.file_url) {
        const fileName = data.file_url.split("/").pop() || "Current PDF file"
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

  const uploadToR2 = async (file: File, kind: "book-cover" | "book-file"): Promise<string | null> => {
    const payload = new FormData()
    payload.append("file", file)
    payload.append("kind", kind)

    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: payload,
    })
    const result = await response.json().catch(() => null)

    if (!response.ok || !result?.success) {
      throw new Error(result?.details || result?.error || `Failed to upload ${kind}`)
    }

    return result.key || null
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
        coverPath = await uploadToR2(coverFile, "book-cover")
      }

      // Upload new PDF if selected
      if (pdfFile) {
        filePath = await uploadToR2(pdfFile, "book-file")
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

      const response = await fetch(`/api/books/${book.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to update book")
      }

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
      <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)] text-[#2c3e30]">
        <header className="border-b border-[#b2cebb66] bg-white/60 backdrop-blur">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
            <h1 className="text-2xl md:text-3xl font-bold text-[#2d5038] text-balance">Edit Book</h1>
            <p className="text-base md:text-lg text-[#5d7766] mt-2">Update your book information</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
          <div className="mx-auto max-w-2xl rounded-2xl border border-[#b2cebb66] bg-white/70 p-4 shadow-[0_6px_24px_rgba(74,124,90,0.08)] backdrop-blur md:p-6">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#4a7c5a] mx-auto mb-4"></div>
                <p className="text-[#5d7766]">Loading book details...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)] text-[#2c3e30]">
        <header className="border-b border-[#b2cebb66] bg-white/60 backdrop-blur">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
            <h1 className="text-2xl md:text-3xl font-bold text-[#2d5038] text-balance">Edit Book</h1>
            <p className="text-base md:text-lg text-[#5d7766] mt-2">Update your book information</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
          <div className="mx-auto max-w-2xl rounded-2xl border border-[#b2cebb66] bg-white/70 p-4 shadow-[0_6px_24px_rgba(74,124,90,0.08)] backdrop-blur md:p-6">
            <div className="text-center py-12">
              <h3 className="text-lg font-semibold mb-2">Book not found</h3>
              <p className="text-sm text-[#5d7766] mb-4">The requested book could not be found.</p>
              <Button asChild className="bg-[#4a7c5a] text-white hover:bg-[#2d5038]">
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
    <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)] text-[#2c3e30]">
      <header className="border-b border-[#b2cebb66] bg-white/60 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
          <div className="flex items-center gap-4 mb-2">
            <Link href="/books">
              <Button variant="ghost" size="sm" className="text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Books
              </Button>
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#2d5038] text-balance">Edit Book</h1>
          <p className="text-base md:text-lg text-[#5d7766] mt-2">Update your book information</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#b2cebb66] bg-white/70 p-4 shadow-[0_6px_24px_rgba(74,124,90,0.08)] backdrop-blur md:p-6">
          <form onSubmit={handleSubmit} className="space-y-6 text-[#2c3e30]">
                {/* Book Cover Upload */}
                <div className="space-y-2">
                  <Label htmlFor="cover" className="text-[#2c3e30]">Book Cover</Label>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-32 h-40 bg-[#eef5f0] border-2 border-dashed border-[#b2cebb80] rounded-lg flex items-center justify-center overflow-hidden">
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
                            <ImageIcon className="mx-auto h-8 w-8 text-[#6f8d7a]" />
                            <p className="mt-1 text-sm text-[#5d7766]">No cover</p>
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
                        className={`${formInputClass} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#4a7c5a] file:text-white hover:file:bg-[#2d5038]`}
                      />
                      <p className="mt-1 text-sm text-[#5d7766]">
                        Upload a cover image for your book. Accepted formats: JPG, PNG, GIF (max 10MB)
                      </p>
                    </div>
                  </div>
                </div>

                {/* PDF File Upload */}
                <div className="space-y-2">
                  <Label htmlFor="pdf" className="text-[#2c3e30]">PDF File</Label>
                  <div className="flex items-start space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-32 h-20 bg-[#eef5f0] border-2 border-dashed border-[#b2cebb80] rounded-lg flex items-center justify-center">
                        <div className="text-center">
                          <FileText className="mx-auto h-6 w-6 text-[#6f8d7a] mb-1" />
                          <p className="text-xs text-[#5d7766]">PDF File</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <Input
                        id="pdf"
                        type="file"
                        accept=".pdf,application/pdf"
                        onChange={handlePdfChange}
                        className={`${formInputClass} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#4a7c5a] file:text-white hover:file:bg-[#2d5038]`}
                      />
                      <p className="mt-1 text-sm text-[#5d7766]">
                        Upload a new PDF file to replace the current one. Accepted format: PDF (max 100MB)
                      </p>
                      {pdfFileName && (
                        <div className="mt-2 flex items-center gap-2 p-2 bg-[#eef5f0] rounded-md border border-[#b2cebb66]">
                          <FileText className="h-4 w-4 text-[#6f8d7a]" />
                          <span className="text-sm text-[#5d7766]">
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
                  <Label htmlFor="title" className="text-[#2c3e30]">Book Title *</Label>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={book.title}
                    placeholder="Enter the book title"
                    required
                    className={formInputClass}
                  />
                </div>

                {/* Author */}
                <div className="space-y-2">
                  <Label htmlFor="author" className="text-[#2c3e30]">Author</Label>
                  <Input
                    id="author"
                    name="author"
                    defaultValue={book.author || ""}
                    placeholder="Enter the author's name"
                    className={formInputClass}
                  />
                </div>

                {/* Description */}
                <div className="space-y-2">
                  <Label htmlFor="description" className="text-[#2c3e30]">Description</Label>
                  <Textarea
                    id="description"
                    name="description"
                    defaultValue={book.description || ""}
                    placeholder="Enter a brief description of the book"
                    rows={4}
                    className={formInputClass}
                  />
                </div>

                {/* Publisher and Year */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="publisher" className="text-[#2c3e30]">Publisher</Label>
                    <Input
                      id="publisher"
                      name="publisher"
                      defaultValue={book.publisher || ""}
                      placeholder="Enter the publisher"
                      className={formInputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="year" className="text-[#2c3e30]">Publication Year</Label>
                    <Input
                      id="year"
                      name="year"
                      type="number"
                      defaultValue={book.year || ""}
                      placeholder="Enter the publication year"
                      min="1000"
                      max={new Date().getFullYear()}
                      className={formInputClass}
                    />
                  </div>
                </div>

                {/* ISBN */}
                <div className="space-y-2">
                  <Label htmlFor="isbn" className="text-[#2c3e30]">ISBN</Label>
                  <Input
                    id="isbn"
                    name="isbn"
                    defaultValue={book.isbn || ""}
                    placeholder="Enter the ISBN"
                    className={formInputClass}
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="tags" className="text-[#2c3e30]">Tags</Label>
                  <Input
                    id="tags"
                    name="tags"
                    defaultValue={book.tags || ""}
                    placeholder="Enter tags separated by commas (e.g., fiction, mystery, thriller)"
                    className={formInputClass}
                  />
                  <p className="text-sm text-[#5d7766]">
                    Separate multiple tags with commas to help categorize your book
                  </p>
                </div>

                {/* Video Section */}
                <div className="space-y-4 pt-4 border-t border-[#b2cebb66]">
                  <h3 className="text-lg font-semibold">Related Video (Optional)</h3>
                  
                  <div className="space-y-2">
                    <Label htmlFor="video_url" className="text-[#2c3e30]">Video URL</Label>
                    <Input
                      id="video_url"
                      name="video_url"
                      defaultValue={book.video_url || ""}
                      placeholder="Enter YouTube, Vimeo, or other video URL"
                      type="url"
                      className={formInputClass}
                    />
                    <p className="text-sm text-[#5d7766]">
                      Paste a link to a video related to this book (YouTube, Vimeo, etc.)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video_title" className="text-[#2c3e30]">Video Title</Label>
                    <Input
                      id="video_title"
                      name="video_title"
                      defaultValue={book.video_title || ""}
                      placeholder="Enter video title"
                      className={formInputClass}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="video_description" className="text-[#2c3e30]">Video Description</Label>
                    <Textarea
                      id="video_description"
                      name="video_description"
                      defaultValue={book.video_description || ""}
                      placeholder="Describe what the video is about"
                      rows={3}
                      className={formInputClass}
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex items-center justify-end space-x-2">
                  <Button type="button" variant="outline" asChild className="border-[#b2cebb80] bg-white/80 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]">
                    <Link href={`/books/${book.id}`}>Cancel</Link>
                  </Button>
                  <Button type="submit" disabled={saving} className="bg-[#4a7c5a] text-white hover:bg-[#2d5038]">
                    {saving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
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
        </div>
      </main>
    </div>
  )
}
