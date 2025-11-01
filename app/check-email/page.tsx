"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Mail, CheckCircle, Clock, AlertCircle } from "lucide-react"

export default function CheckEmailPage() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState<string>("")

  useEffect(() => {
    const emailParam = searchParams.get("email")
    if (emailParam) {
      setEmail(emailParam)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
            <Mail className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
            <CardDescription className="mt-2">
              We've sent a confirmation link to your email address
            </CardDescription>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Email address display */}
          {email && (
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">Confirmation email sent to:</p>
              <p className="font-medium text-purple-900">{email}</p>
            </div>
          )}

          {/* Instructions */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <CheckCircle className="w-5 h-5 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Step 1: Check your inbox</h3>
                <p className="text-sm text-muted-foreground">
                  Look for an email from BookSimple with the subject "Confirm your email address"
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <AlertCircle className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Step 2: Check spam folder</h3>
                <p className="text-sm text-muted-foreground">
                  If you don't see it within 2-3 minutes, check your spam/junk folder
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <Clock className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Step 3: Click the confirmation link</h3>
                <p className="text-sm text-muted-foreground">
                  Click the button in the email to activate your account (link expires in 24 hours)
                </p>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-muted-foreground">After Confirmation</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-3">
            <Button asChild className="w-full" size="lg">
              <Link href="/login">
                Go to Login Page
              </Link>
            </Button>
            
            <div className="text-center text-sm text-muted-foreground">
              <p>Already confirmed your email?</p>
              <Link href="/login" className="text-primary hover:underline font-medium">
                Sign in now →
              </Link>
            </div>
          </div>

          {/* Help text */}
          <div className="bg-muted/50 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground">
              Didn't receive the email? Check your spam folder or try registering again with a different email address.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
