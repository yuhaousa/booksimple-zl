"use client"



import { BookUploadForm } from "@/components/book-upload-form"
import { Toaster } from "@/components/ui/toaster"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase" // Use your shared client!
import { useEffect, useState } from "react"

export default function UploadPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)



  useEffect(() => {
  supabase.auth.getUser().then(({ data }) => {
    console.log("getUser data:", data)
    setUser(data?.user ?? null)
  })
}, [])

  const handleBookAdded = () => {
    router.push("/books")
  }

      console.log("wait to add to book list:")

 const addBookToList = async (bookData) => {
    if (!user) {
      console.error("Warning: User not found, cannot add book.")
      return
    }

    const { error: insertError } = await supabase.from("Booklist").insert({
      ...bookData,
      user_id: user.id // <-- UUID from Supabase Auth
})

if (insertError) {
  console.error("Insert error:", insertError)
} else {
  console.log("Book inserted with user_id:", user.id)
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
