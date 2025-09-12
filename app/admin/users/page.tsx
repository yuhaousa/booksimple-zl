"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { Search, Users, MoreHorizontal } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface UserActivity {
  user_id: string
  book_count: number
  note_count: number
  last_activity: string
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserActivity[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      // Get user activity from books and notes
      const { data: bookData } = await supabase.from("Booklist").select("user_id, created_at")

      const { data: noteData } = await supabase.from("study_notes").select("user_id, created_at")

      // Aggregate user activity
      const userMap = new Map<string, UserActivity>()

      // Process books
      bookData?.forEach((book) => {
        if (book.user_id) {
          const existing = userMap.get(book.user_id) || {
            user_id: book.user_id,
            book_count: 0,
            note_count: 0,
            last_activity: book.created_at,
          }
          existing.book_count++
          if (new Date(book.created_at) > new Date(existing.last_activity)) {
            existing.last_activity = book.created_at
          }
          userMap.set(book.user_id, existing)
        }
      })

      // Process notes
      noteData?.forEach((note) => {
        if (note.user_id) {
          const existing = userMap.get(note.user_id) || {
            user_id: note.user_id,
            book_count: 0,
            note_count: 0,
            last_activity: note.created_at,
          }
          existing.note_count++
          if (new Date(note.created_at) > new Date(existing.last_activity)) {
            existing.last_activity = note.created_at
          }
          userMap.set(note.user_id, existing)
        }
      })

      setUsers(
        Array.from(userMap.values()).sort(
          (a, b) => new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime(),
        ),
      )
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter((user) => user.user_id.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-2">Monitor user activity and manage accounts</p>
        </div>
        <Badge variant="secondary" className="text-sm">
          <Users className="h-3 w-3 mr-1" />
          {users.length} Active Users
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
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
          ) : filteredUsers.length > 0 ? (
            <div className="space-y-4">
              {filteredUsers.map((user) => (
                <div
                  key={user.user_id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-medium text-foreground">User ID: {user.user_id.slice(0, 8)}...</h3>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">
                          {user.book_count} books
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {user.note_count} notes
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Last activity: {new Date(user.last_activity).toLocaleDateString()}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>View Books</DropdownMenuItem>
                      <DropdownMenuItem>View Notes</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
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
