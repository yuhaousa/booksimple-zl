"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Eye, EyeOff } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase"
import { recordUserLogin } from "@/lib/login-tracking"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      // 1. Fetch user from user_list
      const { data: users, error: userError } = await supabase
        .from("user_list")
        .select("*")
        .eq("email", email)
        .limit(1)

      // Debugging output
      console.log("users:", users, "userError:", userError)

      if (userError) throw userError
      if (!users || users.length === 0) {
        throw new Error("No user found with this email.")
      }

      const user = users[0]
      // Hash password using Web Crypto API (compatible with Edge Runtime)
      const encoder = new TextEncoder()
      const data = encoder.encode(password)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const password_hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      if (user.password_hash !== password_hash) {
        throw new Error("Incorrect password.")
      }

      // 2. Sign in with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) throw new Error(authError.message || "Authentication failed.")

      // 3. Record login event for tracking
      if (authData?.user?.id) {
        await recordUserLogin(authData.user.id)
      }

      toast({
        title: "Login successful",
        description: "Welcome back!",
      })

      router.push("/")
    } catch (error: any) {
      // Debugging output
      console.error("Login error:", error)
      toast({
        title: "Login failed",
        description: error?.message || String(error) || "Please check your credentials and try again.",
        variant: "destructive",
      })
      // As a fallback, also show an alert (for debugging)
      alert(error?.message || String(error) || "Please check your credentials and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <BookOpen className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
          <CardDescription>Sign in to your BookList account</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col space-y-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <div className="text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link href="/register" className="text-primary hover:underline font-medium">
                Create one here
              </Link>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
