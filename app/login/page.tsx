"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { BookOpen, Eye, EyeOff, AlertCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { createClient } from "@/lib/supabase"
import { recordUserLogin } from "@/lib/login-tracking"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const confirmed = searchParams.get('confirmed')
    const error = searchParams.get('error')
    
    if (confirmed === 'true') {
      toast({
        title: "Email confirmed",
        description: "Your account has been successfully verified. You can now log in.",
      })
    } else if (error === 'confirmation_failed') {
      toast({
        title: "Confirmation failed",
        description: "There was an issue confirming your email. Please try again or contact support.",
        variant: "destructive",
      })
    }
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("") // Clear any previous errors

    try {
      const supabase = createClient()
      
      // Use Supabase's secure authentication (it handles password hashing securely)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        console.error("Authentication error:", authError)
        
        // Handle specific auth error types with more detailed messages
        let errorMessage = "Please check your credentials and try again."
        
        if (authError.message.includes("Invalid login credentials")) {
          errorMessage = `Invalid email or password. Please check your credentials. If you haven't registered yet, please create an account first.`
        } else if (authError.message.includes("Email not confirmed")) {
          errorMessage = "Please check your email and click the confirmation link before signing in."
        } else if (authError.message.includes("Too many requests")) {
          errorMessage = "Too many login attempts. Please wait a moment before trying again."
        } else if (authError.message.includes("User not found")) {
          errorMessage = "No account found with this email address. Please register first."
        } else if (authError.message.includes("signup_disabled")) {
          errorMessage = "Account registration is currently disabled."
        } else {
          // Show the actual error message for debugging
          errorMessage = `Login failed: ${authError.message}`
        }
        
        throw new Error(errorMessage)
      }

      // Record login event for tracking
      if (authData?.user?.id) {
        await recordUserLogin(authData.user.id)
      }

      toast({
        title: "Login successful",
        description: "Welcome back!",
      })

      router.push("/")
    } catch (error: any) {
      console.error("Login error:", error)
      const errorMessage = error?.message || "Please check your credentials and try again."
      setError(errorMessage)
      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      })
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
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (error) setError("") // Clear error when user starts typing
                }}
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
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (error) setError("") // Clear error when user starts typing
                  }}
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
