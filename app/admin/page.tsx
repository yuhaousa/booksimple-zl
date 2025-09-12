"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Users, BookOpen, FileText, TrendingUp } from "lucide-react"

interface Stats {
  totalUsers: number
  totalBooks: number
  totalNotes: number
  recentActivity: number
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalBooks: 0,
    totalNotes: 0,
    recentActivity: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchStats()
  }, [])

  const fetchStats = async () => {
    try {
      // Fetch total books
      const { count: booksCount } = await supabase.from("Booklist").select("*", { count: "exact", head: true })

      // Fetch total notes
      const { count: notesCount } = await supabase.from("study_notes").select("*", { count: "exact", head: true })

      // Fetch recent activity (books added in last 7 days)
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

      const { count: recentCount } = await supabase
        .from("Booklist")
        .select("*", { count: "exact", head: true })
        .gte("created_at", sevenDaysAgo.toISOString())

      setStats({
        totalUsers: 0, // We don't have access to auth.users table
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
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3">
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <h3 className="font-medium">Manage Books</h3>
                <p className="text-sm text-muted-foreground">View and manage all books in the system</p>
              </div>
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <h3 className="font-medium">User Management</h3>
                <p className="text-sm text-muted-foreground">Monitor user activity and accounts</p>
              </div>
              <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                <h3 className="font-medium">System Health</h3>
                <p className="text-sm text-muted-foreground">Check application performance</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
      </div>
    </div>
  )
}
