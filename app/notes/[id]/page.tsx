"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Edit, Trash2, Calendar, FileText, Tag } from "lucide-react"
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
  Booklist?: {
    title: string
  }
}

export default function NoteDetailsPage() {
  const { user, loading: authLoading } = useAuth(true) // Require authentication
  const params = useParams()
  const router = useRouter()
  const [note, setNote] = useState<StudyNote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user && params.id) {
      fetchNote()
    }
  }, [user, params.id])

  const fetchNote = async () => {
    if (!user) return
    
    try {
      const { data, error } = await supabase
        .from("study_notes")
        .select(`
          *,
          Booklist:book_id (
            title
          )
        `)
        .eq("id", params.id)
        .eq("user_id", user.id) // Only fetch note if it belongs to authenticated user
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error("Note not found or you don't have permission to view it")
        } else {
          throw error
        }
        router.push("/notes")
        return
      }
      
      setNote(data)
    } catch (error) {
      console.error("Error fetching note:", error)
      toast.error("Failed to load study note")
      router.push("/notes")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!note || !user || !confirm("Are you sure you want to delete this note?")) return

    try {
      const { error } = await supabase
        .from("study_notes")
        .delete()
        .eq("id", note.id)
        .eq("user_id", user.id) // Only allow deletion if user owns the note

      if (error) throw error

      toast.success("Note deleted successfully")
      router.push("/notes")
    } catch (error) {
      console.error("Error deleting note:", error)
      toast.error("Failed to delete note")
    }
  }

  // Show auth loading screen while checking authentication
  if (authLoading) {
    return <AuthLoadingScreen />
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading note...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!note) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <h3 className="text-lg font-semibold mb-2">Note not found</h3>
          <Button asChild>
            <Link href="/notes">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Notes
            </Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <Button variant="ghost" asChild>
          <Link href="/notes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Notes
          </Link>
        </Button>

        <div className="flex items-center space-x-2">
          <Button variant="outline" asChild>
            <Link
              href={`/notes/${note.id}/edit`}
              onClick={() => console.log("[v0] Edit button clicked, navigating to:", `/notes/${note.id}/edit`)}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Link>
          </Button>
          <Button variant="destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-balance">{note.title}</CardTitle>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              <span>Created: {new Date(note.created_at).toLocaleDateString()}</span>
            </div>

            {note.updated_at !== note.created_at && (
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                <span>Updated: {new Date(note.updated_at).toLocaleDateString()}</span>
              </div>
            )}

            {note.Booklist && (
              <div className="flex items-center">
                <FileText className="h-4 w-4 mr-1" />
                <span>Book: {note.Booklist.title}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {note.category && <Badge variant="outline">{note.category}</Badge>}

            {note.tags && (
              <div className="flex flex-wrap gap-1">
                {note.tags.split(",").map((tag, index) => (
                  <Badge key={index} variant="secondary">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          {note.content ? (
            <div className="prose prose-sm max-w-none">
              <div className="whitespace-pre-wrap text-sm leading-relaxed">{note.content}</div>
            </div>
          ) : (
            <p className="text-muted-foreground italic">No content available</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
