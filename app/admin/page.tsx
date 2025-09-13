"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { getDailyStatsForLastWeek, getTotalUserCount, DailyStats } from "@/lib/admin-stats"
import { getLatestBooks } from "@/lib/book-tracking"
import { Users, BookOpen, FileText, TrendingUp, Calendar } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

// Function to calculate nice Y-axis domain
const calculateYAxisDomain = (data: DailyStats[], key: 'logins' | 'newBooks') => {
  if (!data || data.length === 0) return [0, 10]
  
  const maxValue = Math.max(...data.map(item => item[key]))
  
  if (maxValue === 0) return [0, 10]
  
  // Calculate the appropriate scale
  let scale = 1
  if (maxValue <= 10) scale = 10
  else if (maxValue <= 100) scale = 100
  else if (maxValue <= 1000) scale = 1000
  else if (maxValue <= 10000) scale = 10000
  else scale = Math.pow(10, Math.ceil(Math.log10(maxValue)))
  
  // Calculate nice upper bound
  const upperBound = Math.ceil(maxValue / scale) * scale
  
  // If the max value is much smaller than the upper bound, use a smaller scale
  if (upperBound / maxValue > 5) {
    const smallerScale = scale / 10
    return [0, Math.ceil(maxValue / smallerScale) * smallerScale]
  }
  
  return [0, upperBound]
}

interface Stats {
  totalUsers: number
  totalBooks: number
  totalNotes: number
  recentActivity: number
}

interface LatestBook {
  id: number
  title: string
  author: string | null
  created_at: string
  cover_url: string | null
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalBooks: 0,
    totalNotes: 0,
    recentActivity: 0,
  })
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([])
  const [latestBooks, setLatestBooks] = useState<LatestBook[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
    fetchDailyStats()
    fetchLatestBooks()
  }, [])

  const fetchLatestBooks = async () => {
    try {
      const books = await getLatestBooks(5)
      setLatestBooks(books)
    } catch (error) {
      console.error("Error fetching latest books:", error)
    }
  }

  const fetchDailyStats = async () => {
    try {
      const data = await getDailyStatsForLastWeek()
      setDailyStats(data)
    } catch (error) {
      console.error("Error fetching daily stats:", error)
    }
  }

  const fetchStats = async () => {
    try {
      // Fetch total books
      const { count: booksCount } = await supabase.from("Booklist").select("*", { count: "exact", head: true })

      // Fetch total notes
      const { count: notesCount } = await supabase.from("study_notes").select("*", { count: "exact", head: true })

      // Fetch total users using the new utility function
      const userCount = await getTotalUserCount()

      // Fetch recent activity (books added in last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { count: recentCount } = await supabase
        .from("Booklist")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString())

      setStats({
        totalUsers: userCount,
        totalBooks: booksCount || 0,
        totalNotes: notesCount || 0,
        recentActivity: recentCount || 0,
      })
    } catch (error) {
      console.error("Error fetching stats:", error)
    } finally {
      setLoading(false)
    }
  }

  const statCards = [
    {
      title: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      description: "Registered users",
      color: "text-blue-600",
    },
    {
      title: "Total Books",
      value: stats.totalBooks,
      icon: BookOpen,
      description: "Books in library",
      color: "text-green-600",
    },
    {
      title: "Study Notes",
      value: stats.totalNotes,
      icon: FileText,
      description: "Notes created",
      color: "text-purple-600",
    },
    {
      title: "Recent Activity",
      value: stats.recentActivity,
      icon: TrendingUp,
      description: "Books added this week",
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
        <p className="text-muted-foreground mt-2">Monitor your BookList application statistics and activity</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Login Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              Daily User Logins (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading chart data...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis 
                    domain={calculateYAxisDomain(dailyStats, 'logins')}
                    tickCount={6}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name === 'logins' ? 'User Logins' : name]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="logins" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Daily Books Added Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-green-600" />
              Daily Books Added (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading chart data...</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyStats}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis 
                    domain={calculateYAxisDomain(dailyStats, 'newBooks')}
                    tickCount={6}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    formatter={(value: number, name: string) => [value, name === 'newBooks' ? 'New Books' : name]}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Bar dataKey="newBooks" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <BookOpen className="h-4 w-4 text-green-600" />
                <div>
                  <p className="text-sm font-medium">{stats.recentActivity} new books added</p>
                  <p className="text-xs text-muted-foreground">In the last 7 days</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <FileText className="h-4 w-4 text-purple-600" />
                <div>
                  <p className="text-sm font-medium">{stats.totalNotes} study notes created</p>
                  <p className="text-xs text-muted-foreground">Total notes in system</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-blue-600" />
              Latest Books Added
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg animate-pulse">
                    <div className="h-12 w-8 bg-muted rounded"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : latestBooks.length > 0 ? (
              <div className="space-y-3">
                {latestBooks.map((book) => (
                  <div
                    key={book.id}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                  >
                    <div className="w-8 h-12 bg-gradient-to-br from-blue-100 to-blue-200 rounded flex items-center justify-center text-blue-600 text-xs font-medium">
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{book.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {book.author ? `by ${book.author}` : 'Unknown Author'}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3 text-muted-foreground" />
                        <p className="text-xs text-muted-foreground">
                          {new Date(book.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {latestBooks.length === 0 && (
                  <div className="text-center py-4">
                    <BookOpen className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No books added yet</p>
                  </div>
                )}
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
    </div>
  )
}
