'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

const LoadingScreen = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="text-center space-y-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
      <div className="space-y-2">
        <p className="text-lg font-medium">Initializing PDF Reader</p>
        <p className="text-muted-foreground">Setting up document viewer...</p>
      </div>
      <div className="flex justify-center">
        <div className="flex space-x-1">
          <div className="animate-bounce h-2 w-2 bg-primary rounded-full" style={{animationDelay: '0ms'}}></div>
          <div className="animate-bounce h-2 w-2 bg-primary rounded-full" style={{animationDelay: '150ms'}}></div>
          <div className="animate-bounce h-2 w-2 bg-primary rounded-full" style={{animationDelay: '300ms'}}></div>
        </div>
      </div>
    </div>
  </div>
)

// Dynamic import to avoid SSR issues with PDF.js
const BookReader = dynamic(() => import('@/components/book-reader').then(mod => ({ default: mod.BookReader })), {
  ssr: false,
  loading: LoadingScreen
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
      console.log('Fetching book data for reader:', bookId)

      const response = await fetch(`/api/books/${bookId}`, { cache: "no-store" })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || 'Failed to load book')
      }

      const data = result.book as Book | undefined
      if (!data) {
        setError('Book not found.')
        return
      }
      
      if (!data.file_url) {
        setError('This book does not have a PDF file available for reading.')
        return
      }

      // Validate file URL
      try {
        const urlTest = new URL(data.file_url, window.location.origin)
        console.log('PDF URL validated:', urlTest.origin)
      } catch (urlError) {
        console.error('Invalid PDF URL:', data.file_url, urlError)
        setError('Invalid PDF file URL. Please contact support.')
        return
      }

      console.log('Book reader data prepared successfully')
      setBook({
        ...data,
        user_id: data.user_id || "",
      })
    } catch (error: any) {
      console.error('Error fetching book:', error)
      let errorMessage = 'Failed to load book.'
      
      if (error.message) {
        if (error.message.includes('JWT')) {
          errorMessage = 'Authentication error. Please log in again.'
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection.'
        } else {
          errorMessage = `Error: ${error.message}`
        }
      }
      
      setError(errorMessage)
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
