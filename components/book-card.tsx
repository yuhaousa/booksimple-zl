"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, Trash2, Edit } from "lucide-react"
import type { Book } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface BookCardProps {
  book: Book
  onBookDeleted?: () => void
}

export function BookCard({ book, onBookDeleted }: BookCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleReadBook = () => {
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
      // Delete files from storage if they exist
      if (book.cover_url && book.cover_url.includes("supabase")) {
        const coverPath = book.cover_url.split("/").pop()
        if (coverPath) {
          await supabase.storage.from("book-cover").remove([coverPath])
        }
      }

      if (book.file_url && book.file_url.includes("supabase")) {
        const filePath = book.file_url.split("/").pop()
        if (filePath) {
          await supabase.storage.from("book-file").remove([filePath])
        }
      }

      // Delete book record from database
      const { error } = await supabase.from("Booklist").delete().eq("id", book.id)

      if (error) throw error

      toast.success("Book deleted successfully")
      onBookDeleted?.()
    } catch (error) {
      console.error("Error deleting book:", error)
      toast.error("Failed to delete book")
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200 border-border">
      <CardContent className="p-4">
        <Link href={`/books/${book.id}`}>
          <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
            <Image
              src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
              alt={book.title || "Book cover"}
              fill
              className="object-cover"
            />
          </div>
        </Link>

        <div className="space-y-2">
          <Link href={`/books/${book.id}`}>
            <h3 className="font-semibold text-foreground line-clamp-2 text-balance hover:text-primary transition-colors cursor-pointer">
              {book.title || "Untitled"}
            </h3>
          </Link>
          <p className="text-sm text-muted-foreground">{book.author || "Unknown Author"}</p>
          {book.year && <p className="text-xs text-muted-foreground">Published: {book.year}</p>}
          {book.created_at && (
            <p className="text-xs text-muted-foreground">Added: {new Date(book.created_at).toLocaleDateString()}</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex flex-col gap-3">
        <div className="flex flex-wrap gap-1 w-full">
          {book.tags &&
            book.tags
              .split(",")
              .slice(0, 2)
              .map((tag, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {tag.trim()}
                </Badge>
              ))}
        </div>

        <div className="flex gap-2 w-full">
          <Button onClick={handleEditBook} variant="outline" size="sm" className="flex-1 bg-transparent">
            <Edit className="w-4 h-4 mr-2" />
            Edit
          </Button>
          <Button onClick={handleDeleteBook} variant="destructive" size="sm" className="flex-1" disabled={isDeleting}>
            <Trash2 className="w-4 h-4 mr-2" />
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
          {book.file_url && (
            <Button onClick={handleReadBook} variant="outline" size="sm" className="flex-1 bg-transparent">
              <BookOpen className="w-4 h-4 mr-2" />
              Read
            </Button>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}
