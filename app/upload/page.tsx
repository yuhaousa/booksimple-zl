"use client"

import { BookUploadForm } from "@/components/book-upload-form"
import { Toaster } from "@/components/ui/toaster"
import { useRouter } from "next/navigation"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient()

export default async function UploadPage() {
  const router = useRouter()

  const handleBookAdded = () => {
    router.push("/books")
  }

  const user = await supabase.auth.getUser()

  const addBookToList = async (bookData) => {
    const { title, author } = bookData
    await supabase.from("Booklist").insert({
      title,
      author,
      user_id: user.data.user.id, // <-- set this!
    })
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-3xl font-bold text-primary text-balance">Add New Book</h1>
          <p className="text-muted-foreground mt-2">Add a new book to your collection</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <BookUploadForm onBookAdded={handleBookAdded} />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
