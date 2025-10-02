'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Dynamic import to avoid SSR issues with PDF.js
const BookReader = dynamic(() => import('@/components/book-reader').then(mod => ({ default: mod.BookReader })), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Loading PDF reader...</p>
      </div>
    </div>
  )
})

interface Book {
  id: number
  title: string
  author: string | null
  publisher: string | null
  year: number | null
  description: string | null
  tags: string | null
  cover_url: string | null
  file_url: string | null
  user_id: string
}

export default function BookReaderPage() {
  const params = useParams()
  const bookId = params.id
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    console.log('Fetching book with ID:', bookId)
    fetchBook()
  }, [bookId])

  const fetchBook = async () => {
    try {
      const { data, error } = await supabase
        .from('Booklist')
        .select('*')
        .eq('id', bookId)
        .single()

      if (error) throw error
      
      if (!data.file_url) {
        setError('This book does not have a PDF file available.')
        return
      }

      // Generate signed URL for the file
      let signedUrl = data.file_url
      if (data.file_url && !data.file_url.startsWith('http')) {
        const { data: signedData, error: signError } = await supabase.storage
          .from('book-file')
          .createSignedUrl(data.file_url.replace(/^book-file\//, ''), 60 * 60 * 24) // 24 hour expiry

        if (!signError && signedData?.signedUrl) {
          signedUrl = signedData.signedUrl
        } else {
          console.error('Error generating signed URL:', signError)
        }
      }

      setBook({ ...data, file_url: signedUrl })
    } catch (error: any) {
      console.error('Error fetching book:', error)
      setError('Failed to load book. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading book reader...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <Link href={`/books/${bookId}`}>
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Book Details
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  if (!book) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Book not found.</p>
          <Link href="/books">
            <Button variant="outline">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Books
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <BookReader book={book} />
    </div>
  )
}
