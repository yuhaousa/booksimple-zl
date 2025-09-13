"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import BannerCarousel from "@/components/banner-carousel"
import { supabase } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen, FileText, Users, BarChart3, Heart, Shield } from "lucide-react"

interface Book {
  id: number
  title: string
  author: string | null
  description: string | null
  cover_url: string | null
  year: number | null
  created_at: string
  user_id: string // <-- must be present
}

export default function HomePage() {
  const [latestBooks, setLatestBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLatestBooks()
  }, [])

  const fetchLatestBooks = async () => {
    try {
      const { data, error } = await supabase
        .from("Booklist")
        .select("id, title, author, user_id, description, cover_url, year, created_at") // include user_id
        .order("created_at", { ascending: false })
        .limit(4)

      if (error) throw error

      // Generate signed URLs for covers
      const booksWithSignedUrls = await Promise.all(
        (data || []).map(async (book) => {
          let coverUrl = book.cover_url

          if (coverUrl) {
            const { data: signedCover, error: coverError } = await supabase.storage
              .from("book-cover")
              .createSignedUrl(coverUrl.replace(/^book-cover\//, ""), 60 * 60 * 24)
            if (!coverError && signedCover?.signedUrl) {
              coverUrl = signedCover.signedUrl
            }
          }

          return { ...book, cover_url: coverUrl }
        })
      )

      setLatestBooks(booksWithSignedUrls)
    } catch (error) {
      console.error("Error fetching latest books:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <BannerCarousel />
      </div>

      <div className="container mx-auto px-4 py-8 md:py-16">
        <div className="text-center space-y-6">
          <h1 className="text-3xl md:text-4xl font-bold text-primary text-balance">Welcome to BookList</h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto text-pretty px-4">
            Your personal digital library management system. Organize, track, and discover your book collection with
            ease.
          </p>

          {/* Latest Books Section */}
          <div className="mt-12 md:mt-16 mb-8 md:mb-12">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 md:mb-8 gap-4">
              <h2 className="text-xl md:text-2xl font-bold text-foreground text-center sm:text-left">Latest Additions</h2>
              <Button variant="outline" size="sm" className="w-fit mx-auto sm:mx-0" asChild>
                <Link href="/books">
                  View All Books
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="bg-muted rounded-lg h-64 mb-3"></div>
                    <div className="bg-muted rounded h-4 mb-2"></div>
                    <div className="bg-muted rounded h-3 w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : latestBooks.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {latestBooks.map((book) => (
                  <Card key={book.id} className="group hover:shadow-lg transition-shadow duration-200 border-border">
                    <CardContent className="p-4">
                      <Link href={`/books/${book.id}`}>
                        <div className="aspect-[3/4] relative mb-4 bg-muted rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                          <Image
                            src={book.cover_url || "/placeholder.svg?height=400&width=300&query=book+cover"}
                            alt={book.title || "Book cover"}
                            fill
                            className="object-cover"
                            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                            onError={(e) => {
                              e.currentTarget.src = "/placeholder.svg?height=400&width=300&query=book+cover"
                            }}
                          />
                        </div>
                      </Link>

                      <div className="space-y-3">
                        <Link href={`/books/${book.id}`}>
                          <h3 className="text-xl font-bold text-foreground line-clamp-2 text-balance hover:text-primary transition-colors cursor-pointer text-left">
                            {book.title || "Untitled"}
                          </h3>
                        </Link>
                        <p className="text-lg text-muted-foreground text-left font-medium">{book.author || "Unknown Author"}</p>
                        {book.description && (
                          <p className="text-base text-muted-foreground text-left line-clamp-2">{book.description}</p>
                        )}
                        {book.year && <p className="text-base text-muted-foreground text-left">Published: {book.year}</p>}
                        {book.created_at && (
                          <p className="text-base text-muted-foreground text-left">
                            Added: {new Date(book.created_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-muted/50 rounded-lg">
                <BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No books yet</h3>
                <p className="text-base text-muted-foreground mb-4">Start building your library by adding your first book</p>
                <Button asChild>
                  <Link href="/upload">Add Your First Book</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Key Features Section */}
      <div className="bg-muted/30 py-12 md:py-16">
        <div className="container mx-auto px-4">
          <div className="text-center space-y-4 md:space-y-6 mb-8 md:mb-12">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">Platform Features</h2>
            <p className="text-base md:text-lg text-muted-foreground max-w-2xl mx-auto px-4">
              Discover all the powerful features that make BookList the perfect solution for managing your digital library
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {/* Library Management */}
            <div className="bg-card border rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold">Library Management</h3>
              <p className="text-muted-foreground text-base">
                Organize your entire book collection with rich metadata, cover images, and detailed information including author, publisher, year, and descriptions.
              </p>
            </div>

            {/* Reading Lists */}
            <div className="bg-card border rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg flex items-center justify-center">
                <Heart className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold">Personal Reading Lists</h3>
              <p className="text-muted-foreground text-base">
                Create and manage your personal reading lists. Track books you want to read, are currently reading, or have completed with status updates.
              </p>
            </div>

            {/* Study Notes */}
            <div className="bg-card border rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              </div>
              <h3 className="text-xl font-semibold">Study Notes</h3>
              <p className="text-muted-foreground text-base">
                Take comprehensive study notes for each book. Organize your thoughts, quotes, and insights with rich text formatting and categorization.
              </p>
            </div>

            {/* Analytics Dashboard */}
            <div className="bg-card border rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-semibold">Analytics & Insights</h3>
              <p className="text-muted-foreground text-base">
                Track your reading progress with detailed analytics. View statistics on book interactions, reading patterns, and library growth over time.
              </p>
            </div>

            {/* Multi-User Support */}
            <div className="bg-card border rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h3 className="text-xl font-semibold">Multi-User Platform</h3>
              <p className="text-muted-foreground text-base">
                Secure multi-user environment where each user has their own private library and reading lists with proper access control and data isolation.
              </p>
            </div>

            {/* Secure Storage */}
            <div className="bg-card border rounded-lg p-6 space-y-4 hover:shadow-lg transition-shadow">
              <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg flex items-center justify-center">
                <Shield className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-semibold">Secure & Private</h3>
              <p className="text-muted-foreground text-base">
                Your books and data are stored securely with industry-standard encryption. Row-level security ensures your library remains completely private.
              </p>
            </div>
          </div>

          <div className="text-center mt-8 md:mt-12">
            <Button size="lg" asChild>
              <Link href="/register">
                Get Started Today
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Call to Action Section */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-background py-12 md:py-20">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-4xl mx-auto space-y-6 md:space-y-8">
            <div className="space-y-3 md:space-y-4">
              <h2 className="text-xl md:text-2xl font-bold text-foreground px-4">Ready to Transform Your Library?</h2>
              <p className="text-base md:text-xl text-muted-foreground max-w-3xl mx-auto px-4">
                Join thousands of book lovers who have already revolutionized their reading experience. 
                Start organizing, tracking, and discovering your perfect digital library today.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center px-4">
              <Button size="lg" className="w-full sm:w-auto sm:min-w-[160px]" asChild>
                <Link href="/register">
                  Start Free Today
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="w-full sm:w-auto sm:min-w-[160px]" asChild>
                <Link href="/books">
                  Explore Features
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-card border-t">
        <div className="container mx-auto px-4 py-8 md:py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            {/* Brand Section */}
            <div className="space-y-4 col-span-1 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center space-x-2 justify-center sm:justify-start">
                <BookOpen className="h-8 w-8 text-primary" />
                <span className="text-xl font-bold text-foreground">BookList</span>
              </div>
              <p className="text-base text-muted-foreground text-center sm:text-left">
                Your personal digital library management system. Organize, track, and discover your book collection with ease.
              </p>
              <div className="flex space-x-4 justify-center sm:justify-start">
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22.46 6c-.77.35-1.6.58-2.46.69.88-.53 1.56-1.37 1.88-2.38-.83.5-1.75.85-2.72 1.05C18.37 4.5 17.26 4 16 4c-2.35 0-4.27 1.92-4.27 4.29 0 .34.04.67.11.98C8.28 9.09 5.11 7.38 3 4.79c-.37.63-.58 1.37-.58 2.15 0 1.49.75 2.81 1.91 3.56-.71 0-1.37-.2-1.95-.5v.03c0 2.08 1.48 3.82 3.44 4.21a4.22 4.22 0 0 1-1.93.07 4.28 4.28 0 0 0 4 2.98 8.521 8.521 0 0 1-5.33 1.84c-.34 0-.68-.02-1.02-.06C3.44 20.29 5.7 21 8.12 21 16 21 20.33 14.46 20.33 8.79c0-.19 0-.37-.01-.56.84-.6 1.56-1.36 2.14-2.23z"/>
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.297 1.199-.335 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24.009 12.017 24.009c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001.012.001z"/>
                  </svg>
                </a>
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4 text-center sm:text-left">
              <h3 className="text-base font-semibold text-foreground uppercase tracking-wider">Features</h3>
              <ul className="space-y-2 text-base text-muted-foreground">
                <li><Link href="/books" className="hover:text-primary transition-colors">Browse Books</Link></li>
                <li><Link href="/upload" className="hover:text-primary transition-colors">Add Books</Link></li>
                <li><Link href="/reading-list" className="hover:text-primary transition-colors">Reading Lists</Link></li>
                <li><Link href="/notes" className="hover:text-primary transition-colors">Study Notes</Link></li>
              </ul>
            </div>

            {/* Account */}
            <div className="space-y-4 text-center sm:text-left">
              <h3 className="text-base font-semibold text-foreground uppercase tracking-wider">Account</h3>
              <ul className="space-y-2 text-base text-muted-foreground">
                <li><Link href="/login" className="hover:text-primary transition-colors">Login</Link></li>
                <li><Link href="/register" className="hover:text-primary transition-colors">Register</Link></li>
                <li><Link href="/admin" className="hover:text-primary transition-colors">Admin</Link></li>
                <li><a href="#" className="hover:text-primary transition-colors">Support</a></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="space-y-4 text-center sm:text-left">
              <h3 className="text-base font-semibold text-foreground uppercase tracking-wider">Legal</h3>
              <ul className="space-y-2 text-base text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Cookie Policy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-6 md:mt-8 pt-6 md:pt-8 flex flex-col md:flex-row justify-between items-center text-center md:text-left space-y-2 md:space-y-0">
            <p className="text-base text-muted-foreground">
              © {new Date().getFullYear()} BookList. All rights reserved.
            </p>
            <p className="text-base text-muted-foreground">
              Made with ❤️ for book lovers everywhere
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
