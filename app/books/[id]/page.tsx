"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BookOpen, ArrowLeft, Calendar, User, Building } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

interface BookDetailPageProps {
  params: { id: string }
}

async function getBookWithNotes(id: string) {
  // Fetch book details
  const { data: book, error: bookError } = await supabase.from("Booklist").select("*").eq("id", id).single()

  if (bookError || !book) {
    return null
  }

  // Fetch related notes
  const { data: notes, error: notesError } = await supabase
    .from("study_notes")
    .select("*")
    .eq("book_id", id)
    .order("created_at", { ascending: false })

  return {
    book,
    notes: notes || [],
  }
}

export default async function BookDetailPage({ params }: BookDetailPageProps) {
  const data = await getBookWithNotes(params.id)

  if (!data) {
    notFound()
  }

  const { book, notes } = data

  const handleReadBook = () => {
    if (book.file_url) {
      window.open(book.file_url, "_blank")
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Link href="/books">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Books
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Book Cover and Actions */}
        <div className="md:col-span-1">
          <Card>
            <CardContent className="p-6">
              <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden">
                <Image
                  src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                  alt={book.title || "Book cover"}
                  fill
                  className="object-cover"
                />
              </div>

              <div className="space-y-3">
                {book.file_url && (
                  <Button onClick={handleReadBook} className="w-full">
                    <BookOpen className="w-4 h-4 mr-2" />
                    Read Book
                  </Button>
                )}

                <Link href={`/books/${book.id}/edit`} className="block">
                  <Button variant="outline" className="w-full bg-transparent">
                    Edit Book
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Book Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl text-balance">{book.title || "Untitled"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                {book.author && (
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{book.author}</span>
                  </div>
                )}
                {book.publisher && (
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    <span>{book.publisher}</span>
                  </div>
                )}
                {book.year && (
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{book.year}</span>
                  </div>
                )}
              </div>

              {book.description && (
                <div>
                  <h3 className="font-semibold mb-2">Description</h3>
                  <p className="text-muted-foreground leading-relaxed">{book.description}</p>
                </div>
              )}

              {book.isbn && (
                <div>
                  <h3 className="font-semibold mb-2">ISBN</h3>
                  <p className="text-muted-foreground font-mono">{book.isbn}</p>
                </div>
              )}

              {book.tags && (
                <div>
                  <h3 className="font-semibold mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2">
                    {book.tags.split(",").map((tag, index) => (
                      <Badge key={index} variant="secondary">
                        {tag.trim()}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Related Notes */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Related Study Notes
                <Link href="/notes/new">
                  <Button size="sm">Add Note</Button>
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {notes.length > 0 ? (
                <div className="space-y-4">
                  {notes.map((note) => (
                    <Link key={note.id} href={`/notes/${note.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardContent className="p-4">
                          <h4 className="font-semibold mb-2">{note.title}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{note.content}</p>
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{note.category}</span>
                            <span>{new Date(note.created_at).toLocaleDateString()}</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  No study notes for this book yet.{" "}
                  <Link href="/notes/new" className="text-primary hover:underline">
                    Create your first note
                  </Link>
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
