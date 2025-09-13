"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { BookOpen, Upload, Home, FileText, LogIn, LogOut, Settings, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"

function useAuthUser() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    const supabase = createClient()
    // Initial check
    supabase.auth.getUser().then(({ data }) => setUser(data?.user ?? null))
    // Listen for auth state changes
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => {
      listener?.subscription.unsubscribe()
    }
  }, [])
  return user
}

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAuthUser()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/books", label: "Books", icon: BookOpen },
    // Only show "Upload" if logged in
    ...(user
      ? [
          { href: "/upload", label: "Upload", icon: Upload },
          { href: "/reading-list", label: "Reading List", icon: BookOpen },
          { href: "/admin", label: "Admin", icon: Settings },
        ]
      : []),
    { href: "/notes", label: "Study Notes", icon: FileText },
  ]

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setMobileMenuOpen(false)
    router.refresh() // This will update the UI after logout
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <nav className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <span className="text-xl font-semibold">BookList</span>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Button
                  key={item.href}
                  asChild
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="flex items-center space-x-2"
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              )
            })}

            {user ? (
              <Button variant="ghost" size="sm" className="flex items-center space-x-2" onClick={handleLogout}>
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="flex items-center space-x-2">
                <Link href="/login">
                  <LogIn className="h-4 w-4" />
                  <span>Login</span>
                </Link>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="flex items-center space-x-2"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t py-4">
            <div className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Button
                    key={item.href}
                    asChild
                    variant={isActive ? "default" : "ghost"}
                    size="sm"
                    className="justify-start flex items-center space-x-2"
                    onClick={closeMobileMenu}
                  >
                    <Link href={item.href}>
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </Button>
                )
              })}

              {user ? (
                <Button variant="ghost" size="sm" className="justify-start flex items-center space-x-2" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              ) : (
                <Button asChild variant="ghost" size="sm" className="justify-start flex items-center space-x-2" onClick={closeMobileMenu}>
                  <Link href="/login">
                    <LogIn className="h-4 w-4" />
                    <span>Login</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
