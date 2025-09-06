"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ArrowLeft, Save } from "lucide-react"
import { toast } from "sonner"

interface StudyNote {
  id: number
  title: string
  content: string
  book_id: number | null
  tags: string | null
  category: string | null
  created_at: string
  updated_at: string
}

export default function EditNotePage() {
  const params = useParams()
  const router = useRouter()
  const [note, setNote] = useState<StudyNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    tags: "",
    category: "",
  })

  useEffect(() => {
    console.log("[v0] Edit page loaded, params:", params)
    if (params.id) {
      fetchNote()
    }
  }, [params]) // Fixed dependency to use entire params object instead of params.id

  const fetchNote = async () => {
    try {
      console.log("[v0] Fetching note for edit with id:", params.id)
      const { data, error } = await supabase.from("study_notes").select("*").eq("id", params.id).single()

      if (error) throw error
      console.log("[v0] Note fetched for edit:", data)

      setNote(data)
      setFormData({
        title: data.title || "",
        content: data.content || "",
        tags: data.tags || "",
        category: data.category || "",
      })
    } catch (error) {
      console.error("Error fetching note:", error)
      toast.error("Failed to load study note")
      router.push("/notes")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!note) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from("study_notes")
        .update({
          title: formData.title,
          content: formData.content,
          tags: formData.tags || null,
          category: formData.category || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", note.id)

      if (error) throw error

      toast.success("Note updated successfully!")
      router.push(`/notes/${note.id}`)
    } catch (error) {
      console.error("Error updating note:", error)
      toast.error("Failed to update note")
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
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
          <Link href={`/notes/${note.id}`}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Note
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl text-balance">Edit Study Note</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange("title", e.target.value)}
                placeholder="Enter note title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="content">Content</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) => handleInputChange("content", e.target.value)}
                placeholder="Write your study notes here..."
                rows={12}
                className="resize-none"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  value={formData.category}
                  onChange={(e) => handleInputChange("category", e.target.value)}
                  placeholder="e.g., Literature, Science, History"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <Input
                  id="tags"
                  value={formData.tags}
                  onChange={(e) => handleInputChange("tags", e.target.value)}
                  placeholder="e.g., important, exam, review (comma-separated)"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-4">
              <Button type="button" variant="outline" asChild>
                <Link href={`/notes/${note.id}`}>Cancel</Link>
              </Button>
              <Button type="submit" disabled={saving || !formData.title.trim()}>
                {saving ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
