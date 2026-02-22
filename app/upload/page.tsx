"use client"

import { useRouter } from "next/navigation"

import { BookUploadForm } from "@/components/book-upload-form"
import { Toaster } from "@/components/ui/toaster"

export default function UploadPage() {
  const router = useRouter()

  const handleBookAdded = () => {
    router.push("/books")
  }

  const addBookToList = async (bookData: Record<string, unknown>) => {
    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bookData),
    })

    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      throw new Error(result?.details || result?.error || "Failed to save book")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary text-balance">Add New Book</h1>
          <p className="text-lg text-muted-foreground mt-2">Add a new book to your collection</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <BookUploadForm onBookAdded={handleBookAdded} addBookToList={addBookToList} />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
