"use client"

import { Button } from "@/components/ui/button"
import { BookOpen, Eye, Edit, Brain, GraduationCap } from "lucide-react"
import Link from "next/link"
import { recordBookClick } from "@/lib/book-tracking"
import { supabase } from "@/lib/supabase"
import { useAuth } from "@/hooks/use-auth"

interface BookActionsProps {
  bookId: string
  fileUrl?: string
}

export function BookActions({ bookId, fileUrl }: BookActionsProps) {
  const { user, loading } = useAuth()
  
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

  const isPdfFile = fileUrl && (fileUrl.toLowerCase().includes('.pdf') || fileUrl.toLowerCase().includes('pdf'))

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-10 bg-muted animate-pulse rounded-md"></div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Always show Read Guide */}
      <Link href={`/books/${bookId}/guide`} className="block">
        <Button variant="outline" className="w-full bg-transparent">
          <GraduationCap className="w-4 h-4 mr-2" />
          Read Guide
        </Button>
      </Link>

      {/* Only show other actions to authenticated users */}
      {user && (
        <>
          {fileUrl && isPdfFile && (
            <Link href={`/books/${bookId}/reader`} className="block">
              <Button className="w-full">
                <Eye className="w-4 h-4 mr-2" />
                Open Reader
              </Button>
            </Link>
          )}

          {fileUrl && (
            <Button onClick={handleReadBook} variant={isPdfFile ? "outline" : "default"} className="w-full bg-transparent">
              <BookOpen className="w-4 h-4 mr-2" />
              {isPdfFile ? "Open in Browser" : "Read Book"}
            </Button>
          )}

          <Link href={`/books/${bookId}/preview`} className="block">
            <Button variant="outline" className="w-full bg-transparent">
              <Brain className="w-4 h-4 mr-2" />
              Book Preview
            </Button>
          </Link>

          <Link href={`/books/${bookId}/edit`} className="block">
            <Button variant="outline" className="w-full bg-transparent">
              <Edit className="w-4 h-4 mr-2" />
              Edit Book
            </Button>
          </Link>
        </>
      )}
    </div>
  )
}
