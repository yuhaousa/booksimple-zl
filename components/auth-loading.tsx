import { BookOpen } from "lucide-react"

export default function AuthLoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[linear-gradient(165deg,#eef5f0_0%,#d8ecdf_40%,#eaf3ec_100%)]">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <BookOpen className="h-12 w-12 text-primary animate-pulse" />
        </div>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-lg text-muted-foreground">Checking authentication...</p>
      </div>
    </div>
  )
}
