"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { Trash2 } from "lucide-react"

export default function DeleteUserPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email) {
      toast({
        title: "Error",
        description: "Please enter an email address",
        variant: "destructive"
      })
      return
    }
    
    if (!confirm(`Are you sure you want to delete the user: ${email}?\n\nThis action cannot be undone!`)) {
      return
    }
    
    setIsLoading(true)
    
    try {
      const response = await fetch('/api/delete-user', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user')
      }
      
      toast({
        title: "Success! ✅",
        description: `User ${email} has been deleted successfully`,
      })
      
      setEmail("")
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)] p-8">
      <div className="max-w-2xl mx-auto">
        <Card className="border-[#b2cebb80] bg-white/85 backdrop-blur">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Delete User Account
            </CardTitle>
            <CardDescription>
              Remove a user account from the system. This will delete the user from authentication and all related data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDelete} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">User Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
              </div>
              
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-800">
                  <strong>⚠️ Warning:</strong> This action is permanent and cannot be undone. The user will be:
                </p>
                <ul className="list-disc list-inside text-sm text-red-700 mt-2 space-y-1">
                  <li>Removed from authentication system</li>
                  <li>Deleted from user_list table</li>
                  <li>Unable to login anymore</li>
                </ul>
              </div>
              
              <Button 
                type="submit" 
                variant="destructive" 
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete User
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
        
        <div className="mt-4 text-center">
          <a href="/" className="text-sm text-muted-foreground hover:underline">
            ← Back to Home
          </a>
        </div>
      </div>
    </div>
  )
}
