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
    <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)] text-[#2c3e30]">
      <header className="border-b border-[#b2cebb66] bg-white/60 backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2d5038] text-balance">Add New Book</h1>
          <p className="text-base md:text-lg text-[#5d7766] mt-2">Add a new book to your collection</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-8 md:px-8">
        <div className="mx-auto max-w-2xl rounded-2xl border border-[#b2cebb66] bg-white/70 p-4 shadow-[0_6px_24px_rgba(74,124,90,0.08)] backdrop-blur md:p-6">
          <BookUploadForm onBookAdded={handleBookAdded} addBookToList={addBookToList} />
        </div>
      </main>

      <Toaster />
    </div>
  )
}
