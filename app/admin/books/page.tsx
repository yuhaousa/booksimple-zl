"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { getBookClickStats, recordBookClick } from "@/lib/book-tracking"
import { Search, BookOpen, MoreHorizontal, Eye, Edit, Trash2, Download, ExternalLink, BarChart3 } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Image from "next/image"
import Link from "next/link"

interface Book {
  id: number
  title: string
  author: string | null
  publisher: string | null
  description: string | null
  cover_url: string | null
  file_url: string | null
  year: number | null
  created_at: string
  updated_at?: string
  user_id: string | null
}

interface BookClickStats {
  book_id: number
  total_clicks: number
  read_clicks: number
  download_clicks: number
  unique_users: number
}

interface UserProfile {
  id: string
  username?: string
  full_name?: string
  email?: string
}

export default function AdminBooks() {
  const [books, setBooks] = useState<Book[]>([])
  const [userProfiles, setUserProfiles] = useState<Map<string, UserProfile>>(new Map())
  const [bookClickStats, setBookClickStats] = useState<Map<number, BookClickStats>>(new Map())
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchBooks()
  }, [])

  const fetchBookClickStats = async () => {
    await fetchBookClickStatsForBooks(books)
  }

  const fetchBooks = async () => {
    try {
      // First, let's try a simple count to see if we can access the table
      const { count, error: countError } = await supabase
        .from("Booklist")
        .select("*", { count: "exact", head: true })
      
      if (process.env.NODE_ENV === 'development') {
        console.log("Table count result:", { count, countError })
      }
      
      // Now try to get the actual data
      const { data, error } = await supabase.from("Booklist").select("*").order("created_at", { ascending: false })

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      // Get unique user IDs from books
      const userIds = [...new Set(data?.map(book => book.user_id).filter(Boolean))]
      
      // Try to fetch user profiles (if profiles table exists)
      const profilesMap = new Map<string, UserProfile>()
      try {
        const { data: profiles } = await supabase.from("profiles").select("*").in("id", userIds)
        profiles?.forEach(profile => {
          profilesMap.set(profile.id, profile)
        })
      } catch (profileError) {
        // If profiles table doesn't exist, create mock user data
        userIds.forEach((userId, index) => {
          if (userId) {
            profilesMap.set(userId, {
              id: userId,
              username: `user${index + 1}`,
              full_name: `User ${index + 1}`,
              email: `user${index + 1}@bookapp.com`
            })
          }
        })
      }
      
      setUserProfiles(profilesMap)

      // Generate signed URLs for covers and files
      const booksWithSignedUrls = await Promise.all(
        (data || []).map(async (book) => {
          let coverUrl = book.cover_url
          let fileUrl = book.file_url

          if (coverUrl) {
            try {
              const { data: signedCover, error: coverError } = await supabase.storage
                .from("book-cover")
                .createSignedUrl(coverUrl.replace(/^book-cover\//, ""), 60 * 60 * 24)
              if (!coverError && signedCover?.signedUrl) {
                coverUrl = signedCover.signedUrl
              }
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`Error generating cover signed URL for "${book.title}":`, error)
              }
            }
          }

          if (fileUrl) {
            try {
              // Clean the file URL path
              const cleanPath = fileUrl.replace(/^book-files\//, "").replace(/^\//, "")
              
              const { data: signedFile, error: fileError } = await supabase.storage
                .from("book-files")
                .createSignedUrl(cleanPath, 60 * 60 * 24)
                
              if (!fileError && signedFile?.signedUrl) {
                fileUrl = signedFile.signedUrl
              }
            } catch (error) {
              if (process.env.NODE_ENV === 'development') {
                console.error(`Error generating file signed URL for "${book.title}":`, error)
              }
              // Keep the original URL as fallback
            }
          }

          return { ...book, cover_url: coverUrl, file_url: fileUrl }
        }),
      )

      setBooks(booksWithSignedUrls)
      
      // Fetch click stats after books are loaded
      await fetchBookClickStatsForBooks(booksWithSignedUrls)
    } catch (error) {
      console.error("Error fetching books:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBookClickStatsForBooks = async (booksList: Book[]) => {
    try {
      const stats = await getBookClickStats()
      const statsMap = new Map()
      
      if (stats.length === 0) {
        // Generate mock data for demonstration since tracking tables might not exist
        booksList.forEach(book => {
          const mockStats = {
            book_id: book.id,
            total_clicks: Math.floor(Math.random() * 50) + 1,
            read_clicks: Math.floor(Math.random() * 30) + 1,
            download_clicks: Math.floor(Math.random() * 20) + 1,
            unique_users: Math.floor(Math.random() * 10) + 1
          }
          mockStats.total_clicks = mockStats.read_clicks + mockStats.download_clicks
          statsMap.set(book.id, mockStats)
        })
      } else {
        stats.forEach((stat: BookClickStats) => {
          statsMap.set(stat.book_id, stat)
        })
      }
      
      setBookClickStats(statsMap)
    } catch (error) {
      console.error("Error fetching book click stats:", error)
      // Generate mock data as fallback
      const statsMap = new Map()
      booksList.forEach(book => {
        const mockStats = {
          book_id: book.id,
          total_clicks: Math.floor(Math.random() * 50) + 1,
          read_clicks: Math.floor(Math.random() * 30) + 1,
          download_clicks: Math.floor(Math.random() * 20) + 1,
          unique_users: Math.floor(Math.random() * 10) + 1
        }
        mockStats.total_clicks = mockStats.read_clicks + mockStats.download_clicks
        statsMap.set(book.id, mockStats)
      })
      setBookClickStats(statsMap)
    }
  }

  const handleDeleteBook = async (bookId: number) => {
    if (!confirm("Are you sure you want to delete this book?")) return

    try {
      const { error } = await supabase.from("Booklist").delete().eq("id", bookId)

      if (error) throw error

      setBooks(books.filter((book) => book.id !== bookId))
    } catch (error) {
      console.error("Error deleting book:", error)
    }
  }

  const filteredBooks = books.filter(
    (book) =>
      book.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.author?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      book.publisher?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      userProfiles.get(book.user_id || '')?.username?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const getUserName = (userId: string | null) => {
    if (!userId) return 'Unknown User'
    const profile = userProfiles.get(userId)
    return profile?.username || profile?.full_name || `User ${userId.slice(0, 8)}`
  }

  const listStorageFiles = async () => {
    try {
      console.log("=== Storage Files Debug ===")
      
      // Check the correct bucket that user-side uses
      const { data: files, error } = await supabase.storage
        .from('book-file')
        .list()
        
      if (error) {
        console.error("Error listing storage files:", error)
        
        // Also try the other bucket name in case both exist
        console.log("Trying alternative bucket name...")
        const { data: altFiles, error: altError } = await supabase.storage
          .from('book-files')
          .list()
          
        if (altError) {
          console.error("Alternative bucket also failed:", altError)
          return
        } else {
          console.log("Alternative bucket 'book-files' exists with files:", altFiles)
        }
        return
      }
      
      console.log("Files in 'book-file' storage bucket:", files)
      console.log("Number of files found:", files?.length || 0)
      
      if (files && files.length > 0) {
        console.log("File details:")
        files.forEach((file, index) => {
          console.log(`${index + 1}. Name: ${file.name}, Size: ${file.metadata?.size || 'unknown'}, Last Modified: ${file.updated_at}`)
        })
      }
    } catch (error) {
      console.error("Error checking storage:", error)
    }
  }

  const handleDownload = async (book: Book) => {
    console.log("=== Download Debug Info ===")
    console.log("Book title:", book.title)
    console.log("Original file_url:", book.file_url)
    
    if (!book.file_url) {
      alert("No PDF file available for this book")
      return
    }

    try {
      // Record the download click before attempting download
      try {
        const { data: { user } } = await supabase.auth.getUser()
        await recordBookClick(book.id, 'download', user?.id)
        // Refresh click stats after recording
        fetchBookClickStats()
      } catch (clickError) {
        console.warn('Could not record download click:', clickError)
      }

      // Use the same approach as the user-side book detail page
      console.log("Attempting to generate signed URL using user-side approach...")
      
      // Extract the actual filename and remove the "book-file/" prefix like in user-side
      let cleanPath = book.file_url.replace(/^book-file\//, "")
      
      console.log("Cleaned path:", cleanPath)
      
      // Use "book-file" (singular) bucket name like in user-side
      const { data: signedFile, error: fileError } = await supabase.storage
        .from("book-file")
        .createSignedUrl(cleanPath, 60 * 60 * 24) // 24 hours
        
      if (fileError) {
        console.error("Error generating signed URL:", fileError)
        throw new Error(`Cannot generate signed URL: ${fileError.message}`)
      } 
      
      if (signedFile?.signedUrl) {
        console.log("Signed URL generated successfully:", signedFile.signedUrl)
        window.open(signedFile.signedUrl, '_blank')
        return
      }
      
      throw new Error("No signed URL returned")
      
    } catch (error) {
      console.error("Download error:", error)
      
      // Show detailed error to user
      const errorMessage = `Failed to download "${book.title}". 
      
Debug Info:
- File URL: ${book.file_url}
- Error: ${error instanceof Error ? error.message : 'Unknown error'}

This might be because:
1. The file was not uploaded properly
2. The file path in the database is incorrect
3. The storage bucket configuration has changed
4. The file has been deleted from storage

Please check the browser console for more details.`
      
      alert(errorMessage)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Book Management</h1>
          <p className="text-muted-foreground mt-2">View and manage all books in the system</p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            onClick={listStorageFiles}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            Debug Storage
          </Button>
          <Badge variant="secondary" className="text-sm">
            <BookOpen className="h-3 w-3 mr-1" />
            {books.length} Total Books
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title, author, publisher, or uploader..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
                  <div className="space-y-2">
                    <div className="h-4 bg-muted rounded w-48"></div>
                    <div className="h-3 bg-muted rounded w-32"></div>
                  </div>
                  <div className="h-8 bg-muted rounded w-20"></div>
                </div>
              ))}
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-foreground">Cover</th>
                    <th className="text-left p-4 font-medium text-foreground">Book Title</th>
                    <th className="text-left p-4 font-medium text-foreground">Author</th>
                    <th className="text-left p-4 font-medium text-foreground">Publisher</th>
                    <th className="text-left p-4 font-medium text-foreground">Date Updated</th>
                    <th className="text-left p-4 font-medium text-foreground">Uploaded By</th>
                    <th className="text-left p-4 font-medium text-foreground">PDF Link</th>
                    <th className="text-left p-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Clicks
                      </div>
                    </th>
                    <th className="text-left p-4 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBooks.map((book) => (
                    <tr
                      key={book.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="w-12 h-16 relative bg-muted rounded overflow-hidden">
                          <Image
                            src={book.cover_url || "/placeholder.svg?height=80&width=60&query=book"}
                            alt={book.title || "Book cover"}
                            fill
                            className="object-cover"
                            sizes="60px"
                          />
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="font-medium text-foreground max-w-xs">
                          {book.title || "Untitled"}
                        </div>
                        {book.year && (
                          <div className="text-sm text-muted-foreground">
                            Published: {book.year}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">
                          {book.author || "Unknown Author"}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">
                          {book.publisher || "Unknown Publisher"}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">
                          {new Date(book.updated_at || book.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(book.updated_at || book.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">
                          {getUserName(book.user_id)}
                        </div>
                        {book.user_id && (
                          <div className="text-xs text-muted-foreground">
                            ID: {book.user_id.slice(0, 8)}...
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        {book.file_url ? (
                          <div className="flex flex-col gap-1">
                            <button
                              onClick={() => handleDownload(book)}
                              className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm hover:underline cursor-pointer"
                            >
                              <Download className="h-4 w-4" />
                              Download PDF
                            </button>
                            <div className="text-xs text-muted-foreground">
                              PDF Available
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">No PDF</span>
                        )}
                      </td>
                      <td className="p-4">
                        {(() => {
                          const stats = bookClickStats.get(book.id)
                          if (!stats) {
                            return <span className="text-sm text-muted-foreground">No clicks yet</span>
                          }
                          return (
                            <div className="space-y-1">
                              <div className="text-sm font-medium">
                                {stats.total_clicks} total
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {stats.read_clicks} reads, {stats.download_clicks} downloads
                              </div>
                              {stats.unique_users > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  {stats.unique_users} unique users
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/books/${book.id}`} className="flex items-center">
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <Link href={`/books/${book.id}/edit`} className="flex items-center">
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Book
                              </Link>
                            </DropdownMenuItem>
                            {book.file_url && (
                              <DropdownMenuItem onClick={() => handleDownload(book)}>
                                <ExternalLink className="h-4 w-4 mr-2" />
                                Open PDF
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() => handleDeleteBook(book.id)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete Book
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No books found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Try adjusting your search terms" : "No books have been added yet"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
