"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, BookOpen, FileText, TrendingUp, Calendar } from "lucide-react"

type Book = {
  id: number
  title: string | null
  author: string | null
  created_at: string
  user_id: string | null
}

type Stats = {
  totalUsers: number
  totalBooks: number
  totalNotes: number
  recentActivity: number
}

async function fetchAllBooks() {
  const all: Book[] = []
  let page = 1
  let total = 0

  do {
    const response = await fetch(`/api/books?page=${page}&pageSize=50&includeAll=true`, { cache: "no-store" })
    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.success) {
      throw new Error(result?.details || result?.error || "Failed to fetch books")
    }

    const batch = (result.books || []) as Book[]
    total = Number(result.total || 0)
    all.push(...batch)
    page += 1

    if (batch.length === 0) break
  } while (all.length < total)

  return all
}

export default function AdminOverview() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadOverview()
  }, [])

  const loadOverview = async () => {
    setLoading(true)
    try {
      const allBooks = await fetchAllBooks()
      setBooks(allBooks)
    } catch (error) {
      console.error("Error loading admin overview:", error)
      setBooks([])
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo<Stats>(() => {
    const now = Date.now()
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000
    const userIds = new Set(books.map((book) => book.user_id).filter(Boolean))
    const recentBooks = books.filter((book) => {
      const time = Date.parse(book.created_at || "")
      return Number.isFinite(time) && time >= sevenDaysAgo
    })

    return {
      totalUsers: userIds.size,
      totalBooks: books.length,
      totalNotes: 0,
      recentActivity: recentBooks.length,
    }
  }, [books])

  const latestBooks = useMemo(() => {
    return [...books]
      .sort((a, b) => Date.parse(b.created_at || "") - Date.parse(a.created_at || ""))
      .slice(0, 5)
  }, [books])

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      description: "Unique uploaders (from D1 books)",
      color: "text-blue-600",
    },
    {
      title: "Total Books",
      value: stats.totalBooks,
      icon: BookOpen,
      description: "Books in D1",
      color: "text-green-600",
    },
    {
      title: "Study Notes",
      value: stats.totalNotes,
      icon: FileText,
      description: "Not migrated in this view",
      color: "text-purple-600",
    },
    {
      title: "Recent Activity",
      value: stats.recentActivity,
      icon: TrendingUp,
      description: "Books added in last 7 days",
      color: "text-orange-600",
    },
  ]

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Admin Overview</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-muted rounded w-3/4"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Overview</h1>
        <p className="text-muted-foreground mt-2">Cloudflare D1/R2 overview for this project</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{stat.value}</div>
              <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-blue-600" />
            Latest Books Added
          </CardTitle>
        </CardHeader>
        <CardContent>
          {latestBooks.length > 0 ? (
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Title
                    </th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Author
                    </th>
                    <th className="text-left p-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Added
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {latestBooks.map((book) => (
                    <tr key={book.id} className="border-b border-border/60 hover:bg-muted/30 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-2 min-w-[220px]">
                          <BookOpen className="h-4 w-4 text-blue-600 shrink-0" />
                          <span className="font-semibold text-foreground">{book.title || "Untitled"}</span>
                        </div>
                      </td>
                      <td className="p-3 text-sm text-foreground">{book.author || "Unknown Author"}</td>
                      <td className="p-3">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>{new Date(book.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-4">
              <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No books found</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
