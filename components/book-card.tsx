import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Book } from "@/lib/supabase"
import Image from "next/image"

interface BookCardProps {
  book: Book
}

export function BookCard({ book }: BookCardProps) {
  return (
    <Card className="group hover:shadow-lg transition-shadow duration-200 border-border">
      <CardContent className="p-4">
        <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden">
          <Image
            src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
            alt={book.title || "Book cover"}
            fill
            className="object-cover"
          />
        </div>

        <div className="space-y-2">
          <h3 className="font-semibold text-foreground line-clamp-2 text-balance">{book.title || "Untitled"}</h3>
          <p className="text-sm text-muted-foreground">{book.author || "Unknown Author"}</p>
          {book.year && <p className="text-xs text-muted-foreground">Published: {book.year}</p>}
          {book.created_at && (
            <p className="text-xs text-muted-foreground">Added: {new Date(book.created_at).toLocaleDateString()}</p>
          )}
        </div>
      </CardContent>

      <CardFooter className="p-4 pt-0">
        <div className="flex flex-wrap gap-1">
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
      </CardFooter>
    </Card>
  )
}
