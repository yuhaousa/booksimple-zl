"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Upload, Sparkles } from "lucide-react"

interface BookUploadFormProps {
  onBookAdded: () => void
  addBookToList: (bookData: any) => Promise<void>
}

export function BookUploadForm({ addBookToList, onBookAdded }: BookUploadFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [isAILoading, setIsAILoading] = useState(false)
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [bookFile, setBookFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>("")
  const [aiCoverUrl, setAiCoverUrl] = useState<string | null>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const { toast } = useToast()

  const handleAIAutofill = async () => {
    if (!bookFile) {
      toast({
        title: "No File Selected",
        description: "Please upload a PDF file first to use AI auto-fill.",
        variant: "destructive",
      })
      return
    }

    setIsAILoading(true)
    try {
      const formData = new FormData()
      formData.append("file", bookFile)

      const response = await fetch("/api/ai-autofill", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to extract metadata")
      }

      const metadata = await response.json()

      // Fill the form fields
      if (formRef.current) {
        const form = formRef.current
        if (metadata.title) (form.elements.namedItem("title") as HTMLInputElement).value = metadata.title
        if (metadata.author) (form.elements.namedItem("author") as HTMLInputElement).value = metadata.author
        if (metadata.publisher) (form.elements.namedItem("publisher") as HTMLInputElement).value = metadata.publisher
        if (metadata.year) (form.elements.namedItem("year") as HTMLInputElement).value = metadata.year.toString()
        if (metadata.isbn) (form.elements.namedItem("isbn") as HTMLInputElement).value = metadata.isbn
        if (metadata.description) (form.elements.namedItem("description") as HTMLTextAreaElement).value = metadata.description
        
        // Store the AI-generated cover URL
        if (metadata.coverImageUrl) {
          setAiCoverUrl(metadata.coverImageUrl)
        }
      }

      toast({
        title: "Success",
        description: metadata.coverImageUrl 
          ? "Book information and cover image filled automatically!" 
          : "Book information filled automatically!",
      })
    } catch (error) {
      console.error("AI autofill error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to extract metadata. Please fill manually.",
        variant: "destructive",
      })
    } finally {
      setIsAILoading(false)
    }
  }

  const uploadFile = async (file: File, kind: "book-cover" | "book-file"): Promise<string | null> => {
    const payload = new FormData()
    payload.append("file", file)
    payload.append("kind", kind)

    const response = await fetch("/api/files/upload", {
      method: "POST",
      body: payload,
    })

    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      throw new Error(result?.details || result?.error || "Upload failed")
    }

    return result.key || null
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setUploadProgress("")

    const formData = new FormData(e.currentTarget)

    try {
      let coverUrl = (formData.get("cover_url") as string) || aiCoverUrl || "/abstract-book-cover.png"
      let fileUrl = formData.get("file_url") as string

      if (coverFile) {
        setUploadProgress("Uploading cover image...")
        const uploadedCoverPath = await uploadFile(coverFile, "book-cover")
        if (uploadedCoverPath) {
          coverUrl = uploadedCoverPath // Save file path, not signed URL
        }
      } else if (aiCoverUrl) {
        // Use the AI-generated cover if no manual upload
        coverUrl = aiCoverUrl
      }

      if (bookFile) {
        setUploadProgress("Uploading book file...")
        const uploadedFilePath = await uploadFile(bookFile, "book-file")
        if (uploadedFilePath) {
          fileUrl = uploadedFilePath // Save file path, not signed URL
        }
      }

      setUploadProgress("Saving book information...")

      const bookData = {
        title: formData.get("title") as string,
        author: formData.get("author") as string,
        description: formData.get("description") as string,
        publisher: formData.get("publisher") as string,
        isbn: formData.get("isbn") as string,
        tags: formData.get("tags") as string,
        year: formData.get("year") ? Number.parseInt(formData.get("year") as string) : null,
        cover_url: coverUrl,
        file_url: fileUrl,
      }

      await addBookToList(bookData)

      toast({
        title: "Success",
        description: "Book added successfully!",
      })

      if (formRef.current) {
        formRef.current.reset()
      }
      setCoverFile(null)
      setBookFile(null)
      setUploadProgress("")
      onBookAdded()
    } catch (error) {
      console.error("Error adding book:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add book. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setUploadProgress("")
    }
  }

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="text-primary">Add New Book</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                name="title"
                required
                placeholder="Enter book title"
                className="border-border focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author *</Label>
              <Input
                id="author"
                name="author"
                required
                placeholder="Enter author name"
                className="border-border focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input
                id="publisher"
                name="publisher"
                placeholder="Enter publisher"
                className="border-border focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Publication Year</Label>
              <Input
                id="year"
                name="year"
                type="number"
                min="1000"
                max="2030"
                placeholder="e.g., 2023"
                className="border-border focus:ring-ring"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input id="isbn" name="isbn" placeholder="Enter ISBN" className="border-border focus:ring-ring" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                name="tags"
                placeholder="fiction, mystery, bestseller"
                className="border-border focus:ring-ring"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="Enter book description"
              rows={3}
              className="border-border focus:ring-ring"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cover_file" className="text-sm text-muted-foreground">
                    Upload Cover Image
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="cover_file"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                      className="border-border focus:ring-ring"
                    />
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {coverFile && <p className="text-sm text-green-600">Selected: {coverFile.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cover_url" className="text-sm text-muted-foreground">
                    Or Enter Cover URL
                  </Label>
                  <Input
                    id="cover_url"
                    name="cover_url"
                    type="url"
                    placeholder="https://example.com/cover.jpg"
                    className="border-border focus:ring-ring"
                    disabled={!!coverFile}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Book File</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="book_file" className="text-sm text-muted-foreground">
                    Upload Book PDF
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="book_file"
                      type="file"
                      accept=".pdf,.epub,.mobi"
                      onChange={(e) => setBookFile(e.target.files?.[0] || null)}
                      className="border-border focus:ring-ring"
                    />
                    <Upload className="h-4 w-4 text-muted-foreground" />
                  </div>
                  {bookFile && <p className="text-sm text-green-600">Selected: {bookFile.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="file_url" className="text-sm text-muted-foreground">
                    Or Enter File URL
                  </Label>
                  <Input
                    id="file_url"
                    name="file_url"
                    type="url"
                    placeholder="https://example.com/book.pdf"
                    className="border-border focus:ring-ring"
                    disabled={!!bookFile}
                  />
                </div>
              </div>
            </div>
          </div>

          {bookFile && (
            <div className="flex justify-center">
              <Button
                type="button"
                onClick={handleAIAutofill}
                disabled={isAILoading || isLoading}
                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
              >
                {isAILoading ? (
                  <>
                    <Sparkles className="mr-2 h-4 w-4 animate-spin" />
                    AI Extracting Metadata...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    AI Auto-Fill Book Info
                  </>
                )}
              </Button>
            </div>
          )}

          {uploadProgress && <div className="text-sm text-[#4a7c5a] bg-[#d6e8dc66] p-2 rounded">{uploadProgress}</div>}

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {isLoading ? "Adding Book..." : "Add Book"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

