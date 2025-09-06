"use client"

import { Button } from "@/components/ui/button"
import { BookOpen } from "lucide-react"
import Link from "next/link"

interface BookActionsProps {
  bookId: string
  fileUrl?: string
}

export function BookActions({ bookId, fileUrl }: BookActionsProps) {
  const handleReadBook = () => {
    if (fileUrl) {
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
