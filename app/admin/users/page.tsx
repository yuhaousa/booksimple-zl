"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase"
import { getAllUsersWithLoginStats } from "@/lib/login-tracking"
import { Search, Users, MoreHorizontal, Calendar, Mail, User, Clock, LogIn } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface UserData {
  id: string
  email: string
  username?: string
  full_name?: string
  created_at: string
  last_sign_in_at?: string
  total_logins: number
  first_login_at?: string
  book_count: number
  note_count: number
  last_activity: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showingPlaceholderData, setShowingPlaceholderData] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      const supabase = createClient()
      
      // Fetch real user data from our admin API
      let authUsers = null
      let needsServiceKey = false
      try {
        const response = await fetch('/api/admin/users')
        const result = await response.json()
        authUsers = result.users
        needsServiceKey = result.needsServiceKey
        if (result.error) {
          console.warn('Auth users fetch error:', result.error)
        }
      } catch (error) {
        console.warn('Failed to fetch auth users:', error)
      }
      
      // Get user activity from books and notes
      const { data: bookData, error: bookError } = await supabase
        .from("Booklist")
        .select("user_id, created_at")
      
      const { data: noteData, error: noteError } = await supabase
        .from("study_notes")
        .select("user_id, created_at")
      
      if (bookError) console.warn('Books data error:', bookError)
      if (noteError) console.warn('Notes data error:', noteError)
      
      // Get login statistics
      let loginStats = []
      try {
        loginStats = await getAllUsersWithLoginStats()
      } catch (error) {
        console.warn('Login stats not available:', error)
      }
      
      // Create user activity map
      const userActivityMap = new Map()
      
      // Process books
      bookData?.forEach((book: any) => {
        if (book.user_id) {
          const existing = userActivityMap.get(book.user_id) || {
            book_count: 0,
            note_count: 0,
            last_activity: book.created_at,
          }
          existing.book_count++
          if (new Date(book.created_at) > new Date(existing.last_activity)) {
            existing.last_activity = book.created_at
          }
          userActivityMap.set(book.user_id, existing)
        }
      })

      // Process notes  
      noteData?.forEach((note: any) => {
        if (note.user_id) {
          const existing = userActivityMap.get(note.user_id) || {
            book_count: 0,
            note_count: 0,
            last_activity: note.created_at,
          }
          existing.note_count++
          if (new Date(note.created_at) > new Date(existing.last_activity)) {
            existing.last_activity = note.created_at
          }
          userActivityMap.set(note.user_id, existing)
        }
      })

      // Combine auth users with activity data
      const userList: UserData[] = []
      
      if (authUsers) {
        // If we have auth users, use real data
        authUsers.forEach((authUser: any) => {
          const activity = userActivityMap.get(authUser.id) || {
            book_count: 0,
            note_count: 0,
            last_activity: authUser.created_at,
          }
          const loginStat = loginStats?.find((stat: any) => stat.user_id === authUser.id)
          
          const userData: UserData = {
            id: authUser.id,
            email: authUser.email || 'No email',
            username: authUser.user_metadata?.username || authUser.user_metadata?.full_name || 'No username',
            full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'No name',
            created_at: authUser.created_at,
            last_sign_in_at: authUser.last_sign_in_at,
            total_logins: loginStat?.total_logins || 0,
            first_login_at: loginStat?.first_login_at || authUser.created_at,
            book_count: activity.book_count,
            note_count: activity.note_count,
            last_activity: activity.last_activity,
          }
          
          userList.push(userData)
        })
        setShowingPlaceholderData(false)
      } else {
        // Fallback: create user data based on activity only
        setShowingPlaceholderData(true)
        for (const [userId, activity] of userActivityMap.entries()) {
          const loginStat = loginStats?.find((stat: any) => stat.user_id === userId)
          
          const userData: UserData = {
            id: userId,
            email: `user-${userId.slice(0, 8)}@domain.com`,
            username: `User ${userId.slice(0, 8)}`,
            full_name: `User ${userId.slice(0, 8)}`,
            created_at: activity.last_activity,
            last_sign_in_at: loginStat?.last_login_at,
            total_logins: loginStat?.total_logins || 0,
            first_login_at: loginStat?.first_login_at,
            book_count: activity.book_count,
            note_count: activity.note_count,
            last_activity: activity.last_activity,
          }
          
          userList.push(userData)
        }
      }

      // Sort by created date (most recent first)
      userList.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )

      setUsers(userList)
    } catch (error) {
      console.error("Error fetching users:", error)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }



  const filteredUsers = users.filter((user) => 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-2">Monitor user activity and manage accounts</p>
          {showingPlaceholderData && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <strong>Note:</strong> Showing placeholder data. Add SUPABASE_SERVICE_ROLE_KEY to .env.local for real user information.
            </div>
          )}
        </div>
        <Badge variant="secondary" className="text-sm">
          <Users className="h-3 w-3 mr-1" />
          {users.length} Total Users
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by email, username, or name..."
                value={searchTerm}
                onChange={(e: any) => setSearchTerm(e.target.value)}
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
          ) : filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left p-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Username
                      </div>
                    </th>
                    <th className="text-left p-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Full Name
                      </div>
                    </th>
                    <th className="text-left p-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </div>
                    </th>
                    <th className="text-left p-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Created
                      </div>
                    </th>
                    <th className="text-left p-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <LogIn className="h-4 w-4" />
                        Last Login
                      </div>
                    </th>
                    <th className="text-left p-4 font-medium text-foreground">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Login Stats
                      </div>
                    </th>
                    <th className="text-left p-4 font-medium text-foreground">Activity</th>
                    <th className="text-left p-4 font-medium text-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-medium text-foreground">
                          {user.username || 'N/A'}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          ID: {user.id.slice(0, 8)}...
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{user.full_name || 'N/A'}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{user.email}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">
                          {new Date(user.created_at).toLocaleDateString()}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(user.created_at).toLocaleTimeString()}
                        </div>
                      </td>
                      <td className="p-4">
                        {user.last_sign_in_at ? (
                          <div>
                            <div className="text-sm text-foreground">
                              {new Date(user.last_sign_in_at).toLocaleDateString()}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(user.last_sign_in_at).toLocaleTimeString()}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Never</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">
                          {user.total_logins} logins
                        </div>
                        {user.first_login_at && (
                          <div className="text-xs text-muted-foreground">
                            First: {new Date(user.first_login_at).toLocaleDateString()}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            {user.book_count} books
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {user.note_count} notes
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last activity: {new Date(user.last_activity).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="p-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>View Profile</DropdownMenuItem>
                            <DropdownMenuItem>View Books</DropdownMenuItem>
                            <DropdownMenuItem>View Notes</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">
                              Suspend User
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
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No users found</h3>
              <p className="text-muted-foreground">
                {searchTerm ? "Try adjusting your search terms" : "No user activity detected"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
