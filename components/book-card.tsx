"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { BookOpen, Edit, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter } from "@/components/ui/card"

type Book = {
  id: number
  created_at: string
  title: string | null
  description: string | null
  author: string | null
  publisher: string | null
  isbn: string | null
  tags: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  user_id: string | null
  video_url: string | null
  video_file_url: string | null
  video_title: string | null
  video_description: string | null
}

interface BookCardProps {
  book: Book
  canEdit?: boolean
  showEdit?: boolean
  isAuthenticated?: boolean
  onBookDeleted?: () => void
}

export function BookCard({
  book,
  canEdit,
  showEdit = true,
  isAuthenticated = false,
  onBookDeleted,
}: BookCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleReadBook = async () => {
    if (book.file_url) {
      window.open(book.file_url, "_blank")
    }
  }

  const handleEditBook = () => {
    router.push(`/books/${book.id}/edit`)
  }

  const handleDeleteBook = async () => {
    if (!confirm(`Are you sure you want to delete "${book.title}"? This action cannot be undone.`)) {
      return
    }

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/books/${book.id}`, {
        method: "DELETE",
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to delete book")
      }

      toast.success("Book and related data deleted successfully")
      onBookDeleted?.()
    } catch (error: any) {
      console.error("Error deleting book:", error)
      toast.error(`Failed to delete book: ${error?.message || "Unknown error occurred"}`)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200 border-border">
      <CardContent className="p-4">
        <Link href={`/books/${book.id}/reader`}>
          <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
            <Image
              src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
              alt={book.title || "Book cover"}
              fill
              className="object-cover"
            />
          </div>
        </Link>

        <div className="space-y-3">
          <Link href={`/books/${book.id}/reader`}>
            <h3 className="text-xl font-bold text-foreground line-clamp-2 text-balance hover:text-primary transition-colors cursor-pointer">
              {book.title || "Untitled"}
            </h3>
          </Link>
          <p className="text-lg text-muted-foreground font-medium">{book.author || "Unknown Author"}</p>
          {book.description && <p className="text-base text-muted-foreground line-clamp-2">{book.description}</p>}
          {book.year && <p className="text-base text-muted-foreground">Published: {book.year}</p>}
          {book.created_at && (
            <p className="text-base text-muted-foreground">Added: {new Date(book.created_at).toLocaleDateString()}</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1 w-full">
          {book.tags &&
            book.tags
              .split(/[,]+/)
              .map((tag) => tag.trim())
              .filter((tag) => tag.length > 0)
              .slice(0, 4)
              .map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {tag}
                </Badge>
              ))}
        </div>

        {isAuthenticated && (
          <div className="flex gap-2 w-full mb-2">
            {book.file_url && book.file_url.toLowerCase().includes("pdf") && (
              <Link href={`/books/${book.id}/reader`} className="flex-1">
                <Button variant="default" size="sm" className="w-full">
                  <BookOpen className="w-4 h-4 mr-2" />
                  Read PDF
                </Button>
              </Link>
            )}
            {book.file_url && (
              <Button onClick={handleReadBook} variant="outline" size="sm" className="flex-1 bg-transparent">
                <BookOpen className="w-4 h-4 mr-2" />
                {book.file_url.toLowerCase().includes("pdf") ? "Open in Browser" : "Read"}
              </Button>
            )}
          </div>
        )}

        {canEdit && (
          <div className="flex gap-2 w-full">
            {showEdit && (
              <Button onClick={handleEditBook} variant="outline" size="sm" className="flex-1 bg-transparent">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}
            <Button
              onClick={handleDeleteBook}
              variant="destructive"
              size="sm"
              className={showEdit ? "flex-1" : "w-full"}
              disabled={isDeleting}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
