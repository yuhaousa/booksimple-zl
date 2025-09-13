"use client"

import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"
import Link from "next/link"
import { recordBookClick } from "@/lib/book-tracking"
import { supabase } from "@/lib/supabase"

interface BookActionsProps {
  bookId: string
  fileUrl?: string
}

export function BookActions({ bookId, fileUrl }: BookActionsProps) {
  const handleReadBook = async () => {
    if (fileUrl) {
      // Record the click before opening the file
      try {
        const { data: { user } } = await supabase.auth.getUser()
        console.log('Recording book click for book ID:', bookId, 'user:', user?.id)
        await recordBookClick(parseInt(bookId), 'read', user?.id)
        console.log('Book click recorded successfully')
      } catch (error) {
        console.warn('Could not record book click:', error)
      }
      
      window.open(fileUrl, "_blank")
    }
  }

  return (
    <div className="space-y-3">
      {fileUrl && (
        <Button onClick={handleReadBook} className="w-full">
          <BookOpen className="w-4 h-4 mr-2" />
          Read Book
        </Button>
      )}

      <Link href={`/books/${bookId}/edit`} className="block">
        <Button variant="outline" className="w-full bg-transparent">
          Edit Book
        </Button>
      </Link>
    </div>
  )
}
