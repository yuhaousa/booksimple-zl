"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Plus, FileText, Calendar, BookOpen } from "lucide-react"
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import AuthLoadingScreen from "@/components/auth-loading"

interface StudyNote {
  id: number
  title: string
  content: string
  book_id: number | null
  tags: string | null
  category: string | null
  created_at: string
  updated_at: string
  book?: {
    id: number
    title: string
  }
}

export default function NotesPage() {
  const { user, loading: authLoading } = useAuth(true) // Require authentication
  const [notes, setNotes] = useState<StudyNote[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user) {
      fetchNotes()
    }
  }, [user])

  const fetchNotes = async () => {
    if (!user) return
    
    try {
      const response = await fetch("/api/study-notes", {
        cache: "no-store",
        headers: {
          "x-user-id": user.id,
        },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to load notes")
      }
      setNotes((result.notes || []) as StudyNote[])
    } catch (error) {
      console.error("Error fetching notes:", error)
      toast.error("Failed to load study notes")
    } finally {
      setLoading(false)
    }
  }

  // Show auth loading screen while checking authentication
  if (authLoading) {
    return <AuthLoadingScreen />
  }

  // Show notes loading after auth is confirmed
  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your study notes...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-balance">Study Notes</h1>
          <p className="text-lg text-muted-foreground mt-2">Organize your learning with detailed study notes</p>
        </div>
        <Button asChild>
          <Link href="/notes/new">
            <Plus className="h-4 w-4 mr-2" />
            New Note
          </Link>
        </Button>
      </div>

      {notes.length === 0 ? (
        <div className="text-center py-12">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">No study notes yet</h3>
          <p className="text-base text-muted-foreground mb-4">Start creating notes to organize your learning</p>
          <Button asChild>
            <Link href="/notes/new">
              <Plus className="h-4 w-4 mr-2" />
              Create your first note
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <Link key={note.id} href={`/notes/${note.id}`} className="block">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                {note.title && note.title !== note.content.substring(0, 50) && note.title !== "Untitled Note" && (
                  <CardHeader>
                    <CardTitle className="text-xl line-clamp-2 hover:text-primary transition-colors">
                      {note.title}
                    </CardTitle>
                  </CardHeader>
                )}
                <CardContent className="space-y-4">
                  {note.content && (
                    <p className="text-base text-muted-foreground line-clamp-3">{note.content}</p>
                  )}

                {note.book && (
                  <div className="flex items-center text-base text-primary">
                    <BookOpen className="h-4 w-4 mr-2" />
                    <Link href={`/books`} className="hover:underline font-medium">
                      {note.book.title}
                    </Link>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex items-center text-base text-muted-foreground">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>{new Date(note.created_at).toLocaleDateString()}</span>
                  </div>
                </div>

                {note.tags && (
                  <div className="flex flex-wrap gap-1">
                    {note.tags.split(/[,，、]+/).map((tag, index) => {
                      const trimmedTag = tag.trim()
                      return trimmedTag ? (
                        <Badge key={index} variant="secondary" className="text-sm">
                          {trimmedTag}
                        </Badge>
                      ) : null
                    })}
                  </div>
                )}

                {note.category && (
                  <Badge variant="outline" className="w-fit text-sm">
                    {note.category}
                  </Badge>
                )}
              </CardContent>
            </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
