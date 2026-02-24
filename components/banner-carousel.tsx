"use client"

import { useState, useEffect } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

const DEFAULT_BANNERS = [
  {
    id: 1,
    title: "Discover New Worlds",
    subtitle: "Explore thousands of books in your personal library",
    image: "/library-with-books-and-warm-lighting.png",
  },
  {
    id: 2,
    title: "Organize Your Collection",
    subtitle: "Keep track of your reading journey with smart categorization",
    image: "/organized-bookshelf-with-modern-design.png",
  },
  {
    id: 3,
    title: "Never Lose a Book Again",
    subtitle: "Digital catalog with search and filtering capabilities",
    image: "/digital-library-interface-on-tablet.png",
  },
]

export default function BannerCarousel() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [slides, setSlides] = useState(DEFAULT_BANNERS)

  useEffect(() => {
    let cancelled = false

    const fetchSiteSettings = async () => {
      try {
        const response = await fetch("/api/site-settings", { cache: "no-store" })
        const result = await response.json().catch(() => null)
        if (!response.ok || !result?.success || !Array.isArray(result?.banners)) return

        const customBanners = (result.banners as string[]).filter((item) => typeof item === "string" && item.trim().length > 0)
        if (!customBanners.length) return

        const mappedSlides = customBanners.map((image, index) => {
          const fallback = DEFAULT_BANNERS[index % DEFAULT_BANNERS.length]
          return {
            id: index + 1,
            title: fallback.title,
            subtitle: fallback.subtitle,
            image,
          }
        })

        if (!cancelled) {
          setSlides(mappedSlides)
          setCurrentSlide(0)
        }
      } catch {
        // Keep defaults when site settings are unavailable.
      }
    }

    void fetchSiteSettings()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (slides.length <= 1) return
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length)
    }, 5000)

    return () => clearInterval(timer)
  }, [slides.length])

  const nextSlide = () => {
    if (slides.length <= 1) return
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    if (slides.length <= 1) return
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  return (
    <div className="relative w-full h-96 overflow-hidden rounded-lg">
      {slides.map((banner, index) => (
        <div
          key={banner.id}
          className={`absolute inset-0 transition-transform duration-500 ease-in-out ${
            index === currentSlide ? "translate-x-0" : index < currentSlide ? "-translate-x-full" : "translate-x-full"
          }`}
        >
          <div
            className="w-full h-full bg-cover bg-center relative"
            style={{ backgroundImage: `url(${banner.image})` }}
          >
            <div className="absolute inset-0 bg-black/40" />
            <div className="absolute inset-0 flex items-center justify-center text-center text-white">
              <div className="space-y-4 max-w-2xl px-4">
                <h2 className="text-4xl font-bold text-balance">{banner.title}</h2>
                <p className="text-xl text-pretty opacity-90">{banner.subtitle}</p>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* Navigation Buttons */}
      <Button
        variant="outline"
        size="icon"
        className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 border-white/30 text-white hover:bg-white/30"
        onClick={prevSlide}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <Button
        variant="outline"
        size="icon"
        className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 border-white/30 text-white hover:bg-white/30"
        onClick={nextSlide}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Dots Indicator */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`w-3 h-3 rounded-full transition-colors ${index === currentSlide ? "bg-white" : "bg-white/50"}`}
            onClick={() => setCurrentSlide(index)}
          />
        ))}
      </div>
    </div>
  )
}
