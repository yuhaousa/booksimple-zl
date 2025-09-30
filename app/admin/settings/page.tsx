"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { Eye, EyeOff, Lock, User, BookOpen } from "lucide-react"

const AVAILABLE_GENRES = [
  "Fiction",
  "Non-Fiction",
  "Science Fiction",
  "Fantasy",
  "Mystery",
  "Thriller",
  "Romance",
  "Historical Fiction",
  "Biography",
  "Self-Help",
  "Business",
  "Science",
  "History",
  "Philosophy",
  "Poetry",
  "Drama",
  "Horror",
  "Adventure",
]

export default function AccountSettingsPage() {
  const { toast } = useToast()
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  // Reading profile state
  const [readingGoal, setReadingGoal] = useState("12")
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>(["Fiction", "Science"])
  const [readingSpeed, setReadingSpeed] = useState("medium")

  const handleGenreToggle = (genre: string) => {
    setFavoriteGenres((prev) => (prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]))
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      })
      return
    }

    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      })
      return
    }

    // TODO: Implement actual password change logic with Supabase
    toast({
      title: "Success",
      description: "Password updated successfully",
    })

    // Reset form
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
  }

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()

    // TODO: Implement actual profile update logic with Supabase
    toast({
      title: "Success",
      description: "Reading profile updated successfully",
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
        <p className="text-muted-foreground mt-2">Manage your account preferences and reading profile</p>
      </div>

      <Tabs defaultValue="password" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="profile">Reading Profile</TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Change Password
              </CardTitle>
              <CardDescription>Update your password to keep your account secure</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showCurrentPassword ? "text" : "password"}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    >
                      {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Update Password
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Reading Profile
              </CardTitle>
              <CardDescription>Customize your reading preferences and goals</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reading-goal">Annual Reading Goal (Books per year)</Label>
                  <Input
                    id="reading-goal"
                    type="number"
                    min="1"
                    max="365"
                    value={readingGoal}
                    onChange={(e) => setReadingGoal(e.target.value)}
                    placeholder="12"
                  />
                  <p className="text-sm text-muted-foreground">Set your yearly reading target</p>
                </div>

                <div className="space-y-3">
                  <Label>Favorite Genres</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {AVAILABLE_GENRES.map((genre) => (
                      <div key={genre} className="flex items-center space-x-2">
                        <Checkbox
                          id={`genre-${genre}`}
                          checked={favoriteGenres.includes(genre)}
                          onCheckedChange={() => handleGenreToggle(genre)}
                        />
                        <label
                          htmlFor={`genre-${genre}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {genre}
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Selected: {favoriteGenres.length > 0 ? favoriteGenres.join(", ") : "None"}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reading-speed">Reading Speed</Label>
                  <select
                    id="reading-speed"
                    value={readingSpeed}
                    onChange={(e) => setReadingSpeed(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="slow">Slow (20-30 pages/hour)</option>
                    <option value="medium">Medium (30-50 pages/hour)</option>
                    <option value="fast">Fast (50+ pages/hour)</option>
                  </select>
                  <p className="text-sm text-muted-foreground">Help us estimate reading times for you</p>
                </div>

                <Button type="submit" className="w-full">
                  Save Reading Profile
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Reading Statistics
              </CardTitle>
              <CardDescription>Your reading journey at a glance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Books Read</p>
                  <p className="text-2xl font-bold">24</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Notes Created</p>
                  <p className="text-2xl font-bold">156</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Reading Streak</p>
                  <p className="text-2xl font-bold">12 days</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
