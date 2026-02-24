"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { LayoutDashboard, Users, BookOpen, Menu, X, Settings, LogOut } from "lucide-react"
import { useAuth } from "@/hooks/use-auth"

const adminNavItems = [
  {
    title: "Overview",
    href: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "User List",
    href: "/admin/users",
    icon: Users,
  },
  {
    title: "Book List",
    href: "/admin/books",
    icon: BookOpen,
  },
  {
    title: "Account Settings",
    href: "/admin/settings",
    icon: Settings,
  },
]

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const { user, signOut } = useAuth()
  const userDisplayName = user?.display_name?.trim() || null
  const userEmail = user?.email?.trim() || null
  const userPrimaryLabel = userDisplayName || userEmail || "Not signed in"
  const userSecondaryLabel =
    userDisplayName && userEmail && userDisplayName.toLowerCase() !== userEmail.toLowerCase() ? userEmail : null

  const handleLogout = async () => {
    await signOut()
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between h-16 px-6 border-b border-sidebar-border">
          <h2 className="text-lg font-semibold text-sidebar-foreground">Admin Dashboard</h2>
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-auto">
          {adminNavItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border p-4 space-y-3">
          <div className="rounded-md bg-sidebar-accent/40 px-3 py-2">
            <div className="text-[11px] uppercase tracking-wide text-sidebar-foreground/70">Logged in</div>
            <div className="text-sm font-medium text-sidebar-foreground break-all">{userPrimaryLabel}</div>
            {userSecondaryLabel && <div className="text-xs text-sidebar-foreground/70 break-all">{userSecondaryLabel}</div>}
          </div>

          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start bg-transparent"
            onClick={handleLogout}
            disabled={!user}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-6">
          <Button variant="ghost" size="sm" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to Main Site
            </Link>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
