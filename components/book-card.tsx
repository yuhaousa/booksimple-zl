"use client"

import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, Trash2, Edit } from "lucide-react"
import type { Book } from "@/lib/supabase"
import { supabase } from "@/lib/supabase"
import { recordBookClick } from "@/lib/book-tracking"
import Image from "next/image"
import { useState } from "react"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import Link from "next/link"

interface BookCardProps {
  book: Book
  canEdit?: boolean
  onBookDeleted?: () => void
}

export function BookCard({ book, canEdit, onBookDeleted }: BookCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const router = useRouter()

  const handleReadBook = async () => {
    if (book.file_url) {
      try {
        // Get current user for tracking
        const { data: { user } } = await supabase.auth.getUser()
        
        // Record the book click tracking
        console.log(`Recording read click for book ID: ${book.id}, user: ${user?.id}`)
        await recordBookClick(book.id, 'read', user?.id)
        console.log(`Book click recorded successfully for book ID: ${book.id}`)
        
        // Open the book file
        window.open(book.file_url, "_blank")
      } catch (error) {
        console.error("Error recording book click:", error)
        // Still open the book even if tracking fails
        window.open(book.file_url, "_blank")
      }
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
      // First check if there are any associated records that would prevent deletion
      const { data: notes, error: notesError } = await supabase
        .from("study_notes")
        .select("id")
        .eq("book_id", book.id)
        .limit(1)

      const { data: readingList, error: readingListError } = await supabase
        .from("reading_list")
        .select("id")
        .eq("book_id", book.id)
        .limit(1)

      const { data: bookClicks, error: clicksError } = await supabase
        .from("book_clicks")
        .select("id")
        .eq("book_id", book.id)
        .limit(1)

      // Check if book has associated data
      const hasNotes = notes && notes.length > 0
      const hasReadingListEntry = readingList && readingList.length > 0
      const hasClickData = bookClicks && bookClicks.length > 0

      if (hasNotes || hasReadingListEntry || hasClickData) {
        const associations = []
        if (hasNotes) associations.push("study notes")
        if (hasReadingListEntry) associations.push("reading list entries")
        if (hasClickData) associations.push("click tracking data")

        const associationText = associations.join(", ")
        const confirmDelete = confirm(
          `⚠️ Warning: This book has associated ${associationText}.\n\n` +
          `Deleting this book will also remove all its associated data:\n` +
          `${associations.map(item => `• ${item}`).join('\n')}\n\n` +
          `Are you sure you want to continue? This action cannot be undone.`
        )

        if (!confirmDelete) {
          setIsDeleting(false)
          return
        }

        // Delete associated data first
        if (hasNotes) {
          await supabase.from("study_notes").delete().eq("book_id", book.id)
        }
        if (hasReadingListEntry) {
          await supabase.from("reading_list").delete().eq("book_id", book.id)
        }
        if (hasClickData) {
          await supabase.from("book_clicks").delete().eq("book_id", book.id)
        }
      }

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

      toast.success("Book and all associated data deleted successfully")
      onBookDeleted?.()
    } catch (error: any) {
      console.error("Error deleting book:", error)
      
      // Handle specific database constraint errors
      if (error.code === '23503') {
        toast.error(
          "Cannot delete book: It has associated data (notes, reading list, or tracking data). " +
          "Please remove associated data first or contact an administrator."
        )
      } else if (error.message?.includes('foreign key')) {
        toast.error(
          "Cannot delete book: It is referenced by other data in the system. " +
          "Please remove any study notes or reading list entries for this book first."
        )
      } else if (error.message?.includes('violates')) {
        toast.error(
          "Cannot delete book: Database constraint violation. " +
          "This book may have dependent data that needs to be removed first."
        )
      } else {
        toast.error(`Failed to delete book: ${error.message || 'Unknown error occurred'}`)
      }
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
          {book.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">
              {book.description}
            </p>
          )}
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
          {canEdit && (
            <>
              <Button onClick={handleEditBook} variant="outline" size="sm" className="flex-1 bg-transparent">
                <Edit className="w-4 h-4 mr-2" />
                Edit
              </Button>
              <Button onClick={handleDeleteBook} variant="destructive" size="sm" className="flex-1" disabled={isDeleting}>
                <Trash2 className="w-4 h-4 mr-2" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </>
          )}
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
