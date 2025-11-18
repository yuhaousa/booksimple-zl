"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase, type Book } from "@/lib/supabase"
import { useRouter } from "next/navigation"
import { useToast } from "@/hooks/use-toast"
import { Upload, Loader2 } from "lucide-react"

interface EditBookFormProps {
  book: Book
}

export function EditBookForm({ book }: EditBookFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [coverUploadProgress, setCoverUploadProgress] = useState(0)
  const [fileUploadProgress, setFileUploadProgress] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const router = useRouter()
  const { toast } = useToast()

  const uploadFile = async (file: File, bucket: string, onProgress: (progress: number) => void) => {
    const fileExt = file.name.split(".").pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`

    onProgress(50)

    const { data, error } = await supabase.storage.from(bucket).upload(fileName, file)

    if (error) {
      console.error(`[v0] Upload error for ${bucket}:`, error)
      throw new Error(`Failed to upload to ${bucket}`)
    }

    onProgress(100)

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(fileName)

    return publicUrl
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const formData = new FormData(e.currentTarget)
      const coverFile = formData.get("coverFile") as File
      const bookFile = formData.get("bookFile") as File

      let coverUrl = (formData.get("coverUrl") as string) || book.cover_url
      let fileUrl = (formData.get("fileUrl") as string) || book.file_url

      // Upload cover image if provided
      if (coverFile && coverFile.size > 0) {
        console.log("[v0] Uploading cover image...")
        coverUrl = await uploadFile(coverFile, "book-cover", setCoverUploadProgress)
      }

      // Upload book file if provided
      if (bookFile && bookFile.size > 0) {
        console.log("[v0] Uploading book file...")
        fileUrl = await uploadFile(bookFile, "book-file", setFileUploadProgress)
      }

      // Normalize tags: convert Chinese commas to English commas
      const rawTags = formData.get("tags") as string
      const normalizedTags = rawTags ? rawTags.replace(/[，、]/g, ',') : ''

      const bookData = {
        title: formData.get("title") as string,
        description: formData.get("description") as string,
        author: formData.get("author") as string,
        publisher: formData.get("publisher") as string,
        isbn: formData.get("isbn") as string,
        tags: normalizedTags,
        year: Number.parseInt(formData.get("year") as string) || null,
        cover_url: coverUrl,
        file_url: fileUrl,
        video_url: formData.get("videoUrl") as string || null,
        video_title: formData.get("videoTitle") as string || null,
        video_description: formData.get("videoDescription") as string || null,
      }

      console.log("[v0] Updating book with data:", bookData)

      const { error } = await supabase.from("Booklist").update(bookData).eq("id", book.id)

      if (error) {
        console.error("[v0] Database update error:", error)
        throw new Error("Failed to update book")
      }

      toast({
        title: "Success",
        description: "Book updated successfully!",
      })

      router.push("/books")
    } catch (error) {
      console.error("[v0] Update error:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update book",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
      setCoverUploadProgress(0)
      setFileUploadProgress(0)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Book Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input id="title" name="title" defaultValue={book.title || ""} required placeholder="Enter book title" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="author">Author</Label>
              <Input id="author" name="author" defaultValue={book.author || ""} placeholder="Enter author name" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher</Label>
              <Input
                id="publisher"
                name="publisher"
                defaultValue={book.publisher || ""}
                placeholder="Enter publisher"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="year">Publication Year</Label>
              <Input id="year" name="year" type="number" defaultValue={book.year || ""} placeholder="Enter year" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="isbn">ISBN</Label>
              <Input id="isbn" name="isbn" defaultValue={book.isbn || ""} placeholder="Enter ISBN" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input id="tags" name="tags" defaultValue={book.tags || ""} placeholder="Enter tags (comma separated)" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={book.description || ""}
              placeholder="Enter book description"
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl">Related Video URL</Label>
            <Input 
              id="videoUrl" 
              name="videoUrl" 
              defaultValue={book.video_url || ""} 
              placeholder="YouTube, Vimeo, or other video link" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoTitle">Video Title</Label>
            <Input 
              id="videoTitle" 
              name="videoTitle" 
              defaultValue={book.video_title || ""} 
              placeholder="Enter video title (optional)" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoDescription">Video Description</Label>
            <Textarea 
              id="videoDescription" 
              name="videoDescription" 
              defaultValue={book.video_description || ""} 
              placeholder="Describe what the video covers" 
              rows={2}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Label>Cover Image</Label>
              <div className="space-y-2">
                <Input name="coverUrl" defaultValue={book.cover_url || ""} placeholder="Cover image URL (optional)" />
                <div className="relative">
                  <Input
                    name="coverFile"
                    type="file"
                    accept="image/*"
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {coverUploadProgress > 0 && coverUploadProgress < 100 && (
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${coverUploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Book File</Label>
              <div className="space-y-2">
                <Input name="fileUrl" defaultValue={book.file_url || ""} placeholder="Book file URL (optional)" />
                <div className="relative">
                  <Input
                    name="bookFile"
                    type="file"
                    accept=".pdf,.epub,.mobi"
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                  <Upload className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
                {fileUploadProgress > 0 && fileUploadProgress < 100 && (
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all duration-300"
                      style={{ width: `${fileUploadProgress}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <Button type="button" variant="outline" onClick={() => router.push("/books")} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Book"
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
