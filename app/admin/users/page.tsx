"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Search, Users, MoreHorizontal, Calendar, Mail, User, Clock, LogIn } from "lucide-react"
import { toast } from "sonner"

import { useAuth } from "@/hooks/use-auth"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface UserData {
  id: string
  email: string
  username?: string
  full_name?: string
  display_name?: string
  created_at: string
  last_sign_in_at?: string | null
  total_logins: number
  first_login_at?: string | null
  book_count: number
  note_count: number
  last_activity: string
}

type AdminUserRow = {
  user_id: string
  created_at?: string | null
}

type AdminUsersApiResponse = {
  success?: boolean
  users?: UserData[]
  adminUsers?: AdminUserRow[]
  error?: string
  details?: string
}

function asDateLabel(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "N/A"
  return new Date(value).toLocaleDateString()
}

function asTimeLabel(value: string | null | undefined) {
  if (!value || !Number.isFinite(Date.parse(value))) return "N/A"
  return new Date(value).toLocaleTimeString()
}

export default function AdminUsers() {
  const { user, loading: authLoading } = useAuth(true)
  const router = useRouter()

  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [showingPlaceholderData, setShowingPlaceholderData] = useState(false)
  const [adminList, setAdminList] = useState<AdminUserRow[]>([])

  const fetchUsers = async () => {
    try {
      const response = await fetch("/api/admin/users", {
        cache: "no-store",
      })
      const result = (await response.json().catch(() => null)) as AdminUsersApiResponse | null

      if (response.status === 401) {
        router.push("/login")
        return
      }
      if (response.status === 403) {
        toast.error("Admin access required")
        router.push("/")
        return
      }
      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to fetch users")
      }

      setUsers(Array.isArray(result.users) ? result.users : [])
      setAdminList(Array.isArray(result.adminUsers) ? result.adminUsers : [])
      setShowingPlaceholderData(false)
    } catch (error: any) {
      console.error("Error fetching users:", error)
      toast.error(error?.message || "Failed to fetch users")
      setUsers([])
      setAdminList([])
    } finally {
      setLoading(false)
    }
  }

  const addAdminUser = async (targetUserId: string) => {
    if (!user?.id) return

    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId: targetUserId }),
      })
      const result = (await response.json().catch(() => null)) as AdminUsersApiResponse | null

      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to add admin user")
      }

      toast.success("User added as admin")
      await fetchUsers()
    } catch (error: any) {
      toast.error(error?.message || "Failed to add admin user")
    }
  }

  useEffect(() => {
    if (authLoading) return
    if (!user?.id) return
    fetchUsers()
  }, [authLoading, user?.id])

  const filteredUsers = users.filter((item) => {
    const target = searchTerm.toLowerCase()
    return (
      item.email.toLowerCase().includes(target) ||
      (item.username || "").toLowerCase().includes(target) ||
      (item.full_name || "").toLowerCase().includes(target)
    )
  })

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-2">Admin Users</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 font-medium text-foreground">Admin User ID</th>
                <th className="text-left p-2 font-medium text-foreground">Email</th>
              </tr>
            </thead>
            <tbody>
              {adminList.length > 0 ? (
                adminList.map((admin) => {
                  const userInfo = users.find((entry) => entry.id === admin.user_id)
                  return (
                    <tr key={admin.user_id} className="border-b border-border/50">
                      <td className="p-2 text-sm text-foreground">{admin.user_id}</td>
                      <td className="p-2 text-sm text-foreground">
                        {userInfo ? userInfo.email : <span className="text-muted-foreground">Not found</span>}
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td className="p-2 text-muted-foreground">No admin users found</td>
                  <td className="p-2 text-muted-foreground"></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground mt-2">Monitor user activity and manage accounts</p>
          {showingPlaceholderData && (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
              <strong>Note:</strong> Showing placeholder data.
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
                onChange={(event: any) => setSearchTerm(event.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg animate-pulse">
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
                  {filteredUsers.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-border/50 hover:bg-muted/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-medium text-foreground">{entry.username || "N/A"}</div>
                        <div className="text-sm text-muted-foreground">ID: {entry.id.slice(0, 8)}...</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{entry.display_name || entry.full_name || "N/A"}</div>
                        <div className="text-xs text-muted-foreground mt-1">{entry.username || ""}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{entry.email}</div>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{asDateLabel(entry.created_at)}</div>
                        <div className="text-xs text-muted-foreground">{asTimeLabel(entry.created_at)}</div>
                      </td>
                      <td className="p-4">
                        {entry.last_sign_in_at ? (
                          <div>
                            <div className="text-sm text-foreground">{asDateLabel(entry.last_sign_in_at)}</div>
                            <div className="text-xs text-muted-foreground">{asTimeLabel(entry.last_sign_in_at)}</div>
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground">Never</div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-foreground">{entry.total_logins} logins</div>
                        {entry.first_login_at && (
                          <div className="text-xs text-muted-foreground">
                            First: {asDateLabel(entry.first_login_at)}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Badge variant="outline" className="text-xs">
                            {entry.book_count} books
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {entry.note_count} notes
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Last activity: {asDateLabel(entry.last_activity)}
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
                            <DropdownMenuItem onClick={() => addAdminUser(entry.id)}>Add as Admin</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive">Suspend User</DropdownMenuItem>
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
