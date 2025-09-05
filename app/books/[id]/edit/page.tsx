"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import { createClient } from "@/lib/supabase"

export default function EditBookPage() {
  const router = useRouter()
  const { id } = useParams()
  const supabase = createClient()
  const [book, setBook] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [form, setForm] = useState({
    title: "",
    author: "",
    description: "",
    publisher: "",
    isbn: "",
    tags: "",
    year: "",
    cover_url: "",
    file_url: ""
  })
  const [coverFile, setCoverFile] = useState<File | null>(null)
  const [bookFile, setBookFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<string>("")
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const fetchBook = async () => {
      const { data } = await supabase.from("Booklist").select("*").eq("id", id).single()
      if (data) {
        let coverSignedUrl = ""
        let fileSignedUrl = ""

        if (data.cover_url) {
          const { data: signedCover } = await supabase
            .storage
            .from("book-cover")
            .createSignedUrl(data.cover_url.replace(/^book-cover\//, ""), 60 * 60 * 24)
          coverSignedUrl = signedCover?.signedUrl || ""
        }

        if (data.file_url) {
          const { data: signedFile } = await supabase
            .storage
            .from("book-file")
            .createSignedUrl(data.file_url.replace(/^book-file\//, ""), 60 * 60 * 24)
          fileSignedUrl = signedFile?.signedUrl || ""
        }

        setBook({
          ...data,
          coverSignedUrl,
          fileSignedUrl
        })
        setForm({
          title: data.title || "",
          author: data.author || "",
          description: data.description || "",
          publisher: data.publisher || "",
          isbn: data.isbn || "",
          tags: data.tags || "",
          year: data.year ? String(data.year) : "",
          cover_url: data.cover_url || "",
          file_url: data.file_url || ""
        })
      }
      setIsLoading(false)
    }
    fetchBook()
  }, [id, supabase])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setCoverFile(e.target.files[0])
    }
  }

  const handleBookFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setBookFile(e.target.files[0])
    }
  }

  const uploadFile = async (file: File, bucket: string): Promise<string | null> => {
    const fileExt = file.name.split(".").pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
    const filePath = fileName
    const { data, error } = await supabase.storage.from(bucket).upload(filePath, file)
    if (error) throw new Error(error.message)
    return data.path
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setUploadProgress("")

    let coverUrl = form.cover_url
    let fileUrl = form.file_url

    if (coverFile) {
      setUploadProgress("Uploading cover image...")
      const uploadedCoverPath = await uploadFile(coverFile, "book-cover")
      if (uploadedCoverPath) coverUrl = uploadedCoverPath
    }

    if (bookFile) {
      setUploadProgress("Uploading book file...")
      const uploadedFilePath = await uploadFile(bookFile, "book-file")
      if (uploadedFilePath) fileUrl = uploadedFilePath
    }

    setUploadProgress("Saving book information...")

    const updateData = {
      ...form,
      year: form.year ? Number(form.year) : null,
      cover_url: coverUrl,
      file_url: fileUrl
    }
    const { error } = await supabase.from("Booklist").update(updateData).eq("id", id)
    if (!error) {
      router.push("/books")
    }
    setUploadProgress("")
  }

  if (isLoading) return <div>Loading...</div>
  if (!book) return <div>Book not found</div>

  return (
    <div className="max-w-xl mx-auto py-8">
      <h1 className="text-2xl font-bold mb-4">Edit Book Info</h1>
      <form onSubmit={handleSave} ref={formRef} className="space-y-4">
        <input
          name="title"
          value={form.title}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="Title"
          required
        />
        <input
          name="author"
          value={form.author}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="Author"
          required
        />
        <textarea
          name="description"
          value={form.description}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="Description"
          rows={3}
        />
        <input
          name="publisher"
          value={form.publisher}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="Publisher"
        />
        <input
          name="isbn"
          value={form.isbn}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="ISBN"
        />
        <input
          name="tags"
          value={form.tags}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="Tags (comma separated)"
        />
        <input
          name="year"
          type="number"
          value={form.year}
          onChange={handleChange}
          className="w-full border px-3 py-2 rounded"
          placeholder="Year"
        />

        {/* Cover image upload */}
        <div>
          <label className="block mb-1 font-medium">Book Cover</label>
          {form.cover_url && (
            <img
              src={`https://hbqurajgjhmdpgjuvdcy.supabase.co/storage/v1/object/public/book-cover/${form.cover_url.replace(/^book-cover\//, "")}`}
              alt="Book Cover"
              className="mb-2 w-32 h-44 object-cover border rounded"
            />
          )}
          <input type="file" accept="image/*" onChange={handleCoverChange} />
        </div>

        {/* Book file upload */}
        <div>
          <label className="block mb-1 font-medium">Book File (PDF)</label>
          {form.file_url && (
            <a
              href={`https://hbqurajgjhmdpgjuvdcy.supabase.co/storage/v1/object/public/book-file/${form.file_url.replace(/^book-file\//, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline block mb-2"
            >
              Current PDF
            </a>
          )}
          <input type="file" accept="application/pdf" onChange={handleBookFileChange} />
        </div>

        <button type="submit" className="bg-primary text-white px-4 py-2 rounded">Save</button>
        {uploadProgress && <div className="text-sm text-muted-foreground">{uploadProgress}</div>}
      </form>
    </div>
  )
}
