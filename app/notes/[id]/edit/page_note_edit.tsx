"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save } from "lucide-react"
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
  user_id: string
}

export default function EditNotePage() {
  const { user, loading: authLoading } = useAuth(true)
  const params = useParams()
  const router = useRouter()
  const [note, setNote] = useState<StudyNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    tags: "",
    category: ""
  })

  useEffect(() => {
    if (user && params.id) {
      fetchNote()
    }
  }, [user, params.id])

  const fetchNote = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/study-notes/${params.id}`, {
        cache: "no-store",
        headers: {
          "x-user-id": user.id,
        },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success || !result?.note) {
        if (response.status === 404) {
          toast.error("Note not found or you don't have permission to edit it")
        } else {
          throw new Error(result?.details || result?.error || "Failed to load note")
        }
        router.push("/notes")
        return
      }

      const data = result.note as StudyNote
      setNote(data)
      setFormData({
        title: data.title || "",
        content: data.content || "",
        tags: data.tags || "",
        category: data.category || ""
      })
    } catch (error) {
      console.error("Error fetching note:", error)
      toast.error("Failed to load note")
      router.push("/notes")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!note || !user) return

    if (!formData.content.trim()) {
      toast.error("Please enter note content")
      return
    }

    setSaving(true)

    try {
      // Normalize tags: replace Chinese/Japanese commas with English commas
      const normalizedTags = formData.tags ? formData.tags.replace(/[，、]/g, ',') : ''
      
      // Auto-generate title from content if no title provided
      const finalTitle = formData.title.trim() || formData.content.trim().substring(0, 50)

      const response = await fetch(`/api/study-notes/${note.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": user.id,
        },
        body: JSON.stringify({
          title: finalTitle,
          content: formData.content.trim(),
          tags: normalizedTags,
          category: formData.category.trim() || null,
        }),
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to update note")
      }

      toast.success("Note updated successfully")
      router.push(`/notes/${note.id}`)
    } catch (error) {
      console.error("Error updating note:", error)
      toast.error("Failed to update note")
    } finally {
      setSaving(false)
    }
  }

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
    return null
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" asChild>
            <Link href={`/notes/${note.id}`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h1 className="text-2xl md:text-3xl font-bold">Edit Note</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Note Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">Title (Optional)</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter note title (optional)"
                />
                <p className="text-sm text-muted-foreground">
                  If left empty, the first 50 characters of content will be used as title
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="content">Content *</Label>
                <Textarea
                  id="content"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  placeholder="Enter your note content..."
                  className="min-h-[300px]"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="e.g., Summary, Analysis, Review"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  placeholder="Separate tags with commas"
                />
                <p className="text-sm text-muted-foreground">
                  Use commas (English, Chinese, or Japanese) to separate tags
                </p>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={saving} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save Changes"}
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => router.push(`/notes/${note.id}`)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  )
}
