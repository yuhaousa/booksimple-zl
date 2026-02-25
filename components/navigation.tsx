"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { BookOpen, Upload, Home, FileText, LogIn, LogOut, Settings, Menu, X } from "lucide-react"
import { useEffect, useState } from "react"
import { useAuth } from "@/hooks/use-auth"

export function Navigation() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [siteLogoUrl, setSiteLogoUrl] = useState<string | null>(null)
  const userDisplayName = user?.display_name?.trim() || null
  const userEmail = user?.email?.trim() || null
  const userPrimaryLabel = userDisplayName || userEmail || "Logged in"
  const userSecondaryLabel =
    userDisplayName && userEmail && userDisplayName.toLowerCase() !== userEmail.toLowerCase() ? userEmail : null

  useEffect(() => {
    let cancelled = false

    const loadAdminAccess = async () => {
      if (!user?.id) {
        if (!cancelled) setIsAdmin(false)
        return
      }

      try {
        const response = await fetch("/api/admin/access", { cache: "no-store" })
        const result = await response.json().catch(() => null)
        if (!cancelled) {
          setIsAdmin(Boolean(response.ok && result?.success && result?.isAdmin))
        }
      } catch {
        if (!cancelled) setIsAdmin(false)
      }
    }

    void loadAdminAccess()

    return () => {
      cancelled = true
    }
  }, [user?.id])

  useEffect(() => {
    let cancelled = false

    const loadSiteSettings = async () => {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" })
        const result = await response.json().catch(() => null)
        if (!cancelled) {
          const logoUrl = typeof result?.logoUrl === "string" && result.logoUrl.trim().length > 0 ? result.logoUrl : null
          setSiteLogoUrl(logoUrl)
        }
      } catch {
        if (!cancelled) setSiteLogoUrl(null)
      }
    }

    void loadSiteSettings()

    return () => {
      cancelled = true
    }
  }, [])

  const navItems = [
    { href: "/", label: "Home", icon: Home },
    { href: "/books", label: "Books", icon: BookOpen },
    // Only show authenticated user features if logged in
    ...(user
      ? [
          { href: "/upload", label: "Upload", icon: Upload },
          { href: "/reading-list", label: "Reading List", icon: BookOpen },
          { href: "/notes", label: "Study Notes", icon: FileText },
          ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: Settings }] : []),
        ]
      : []),
  ]

  const handleLogout = async () => {
    await signOut()
    setMobileMenuOpen(false)
    router.refresh()
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-[#b2cebb66] bg-[#eef5f0cc] backdrop-blur-xl">
      <div className="mx-auto w-full max-w-7xl px-4 md:px-8">
        <div className="flex h-[72px] items-center justify-between">
          <Link href="/" className="flex items-center">
            {siteLogoUrl ? (
              <Image src={siteLogoUrl} alt="Site logo" width={180} height={48} className="h-11 w-auto object-contain" priority />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[#7aaa8750] bg-white/70 text-[#4a7c5a] shadow-sm">
                <BookOpen className="h-5 w-5" />
              </div>
            )}
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href

              return (
                <Button
                  key={item.href}
                  asChild
                  variant="ghost"
                  size="sm"
                  className={`flex items-center space-x-2 border ${
                    isActive
                      ? "border-[#4a7c5a] bg-[#4a7c5a] text-white hover:bg-[#2d5038]"
                      : "border-transparent text-[#4d6655] hover:border-[#b2cebb80] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                  }`}
                >
                  <Link href={item.href}>
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                </Button>
              )
            })}

            {user ? (
              <>
                <div className="px-2 text-right leading-tight">
                  <div className="text-xs font-medium text-[#2d5038]">{userPrimaryLabel}</div>
                  {userSecondaryLabel && <div className="text-[11px] text-[#6f8d7a]">{userSecondaryLabel}</div>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center space-x-2 border border-[#b2cebb80] bg-white/70 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              </>
            ) : (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="flex items-center space-x-2 border border-[#b2cebb80] bg-white/70 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
              >
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
              className="flex items-center space-x-2 border border-[#b2cebb80] bg-white/70 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-[#b2cebb66] py-4">
            <div className="flex flex-col space-y-2">
              {user && (
                <div className="mx-1 mb-2 rounded-md border border-[#b2cebb80] bg-white/70 px-3 py-2">
                  <div className="text-xs uppercase tracking-wide text-[#6f8d7a]">Logged in as</div>
                  <div className="text-sm font-medium text-[#2d5038] break-all">{userPrimaryLabel}</div>
                  {userSecondaryLabel && <div className="text-xs text-[#6f8d7a] break-all">{userSecondaryLabel}</div>}
                </div>
              )}

              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href

                return (
                  <Button
                    key={item.href}
                    asChild
                    variant="ghost"
                    size="sm"
                    className={`justify-start flex items-center space-x-2 border ${
                      isActive
                        ? "border-[#4a7c5a] bg-[#4a7c5a] text-white hover:bg-[#2d5038]"
                        : "border-transparent text-[#4d6655] hover:border-[#b2cebb80] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                    }`}
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start flex items-center space-x-2 border border-[#b2cebb80] bg-white/70 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                  onClick={handleLogout}
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout</span>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className="justify-start flex items-center space-x-2 border border-[#b2cebb80] bg-white/70 text-[#4d6655] hover:bg-[#d6e8dc99] hover:text-[#2d5038]"
                  onClick={closeMobileMenu}
                >
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
