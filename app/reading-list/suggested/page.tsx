"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, BookOpen, Lightbulb, Plus, User } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Suggestion = {
  id: number
  title: string | null
  author: string | null
  publisher: string | null
  year: number | null
  cover_url: string | null
  file_url: string | null
  description: string | null
  tags: string | null
  score: number
  reasons: string[]
}

export default function SuggestedReadingPage() {
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<number | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (authLoading) return
      if (!user) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch("/api/reading-list/suggestions", {
          cache: "no-store",
          headers: {
            "x-user-id": user.id,
          },
        })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.success) {
          throw new Error(result?.details || result?.error || "Failed to load suggestions")
        }
        setSuggestions((result.suggestions || []) as Suggestion[])
      } catch (error) {
        console.error("Error loading suggestions:", error)
        toast.error("Failed to load suggestions")
      } finally {
        setLoading(false)
      }
    }

    void fetchSuggestions()
  }, [authLoading, user])

  const addToReadingList = async (bookId: number) => {
    if (!user || addingId) return

    setAddingId(bookId)
    try {
      const response = await fetch("/api/reading-list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({ book_id: bookId, status: "to_read" }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to add book")
      }

      setSuggestions((prev) => prev.filter((item) => item.id !== bookId))
      toast.success("Book added to your reading list")
    } catch (error) {
      console.error("Error adding book:", error)
      toast.error("Failed to add book to reading list")
    } finally {
      setAddingId(null)
    }
  }

  if (authLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[360px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking login status...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[360px]">
          <div className="text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Please log in to view suggestions.</h3>
            <Button asChild>
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold text-primary">Suggested Reading</h1>
          <p className="text-muted-foreground">Recommendations based on your reading list.</p>
        </div>
        <Button variant="outline" asChild>
          <Link href="/reading-list">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Reading List
          </Link>
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center min-h-[280px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Finding recommendations...</p>
          </div>
        </div>
      ) : suggestions.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center">
            <Lightbulb className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No suggestions yet</h3>
            <p className="text-muted-foreground mb-4">
              Add more books to your reading list and we will suggest similar titles.
            </p>
            <Button asChild>
              <Link href="/books">Browse Books</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {suggestions.map((book) => (
            <Card key={book.id} className="overflow-hidden">
              <div className="aspect-[3/4] relative bg-muted">
                <Image
                  src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                  alt={book.title || "Book cover"}
                  fill
                  className="object-cover"
                />
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-base line-clamp-2">
                  <Link href={`/books/${book.id}`} className="hover:text-primary transition-colors">
                    {book.title || "Untitled"}
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {book.author && (
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <User className="w-3 h-3" />
                    <span className="line-clamp-1">{book.author}</span>
                  </div>
                )}

                {book.reasons.length > 0 && (
                  <div className="space-y-1">
                    {book.reasons.slice(0, 2).map((reason, index) => (
                      <Badge key={index} variant="secondary" className="mr-1 mb-1">
                        {reason}
                      </Badge>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1 bg-transparent" asChild>
                    <Link href={`/books/${book.id}`}>Details</Link>
                  </Button>
                  <Button size="sm" className="flex-1" disabled={addingId === book.id} onClick={() => addToReadingList(book.id)}>
                    {addingId === book.id ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2" />
                        Adding
                      </>
                    ) : (
                      <>
                        <Plus className="w-3 h-3 mr-1" />
                        Add
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
