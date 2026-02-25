"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import Image from "next/image"
import Link from "next/link"
import { Cormorant_Garamond, Jost, Playfair_Display } from "next/font/google"
import { ArrowRight, BookOpen, Brain, Library, ShieldCheck } from "lucide-react"

import { Button } from "@/components/ui/button"

interface Book {
  id: number
  title: string
  author: string | null
  description: string | null
  cover_url: string | null
  year: number | null
  created_at: string
}

const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--font-home-serif",
})

const jost = Jost({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-home-sans",
})

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["300", "400"],
  style: ["italic"],
  variable: "--font-home-quote",
})

const BOKEH_DOTS = [
  { left: "6%", top: "8%", size: 180, op: 0.28, dx: "12px", dy: "-10px", dur: "7s", delay: "0s" },
  { left: "84%", top: "12%", size: 220, op: 0.24, dx: "-16px", dy: "8px", dur: "9s", delay: "0.6s" },
  { left: "12%", top: "56%", size: 140, op: 0.22, dx: "10px", dy: "12px", dur: "8s", delay: "1.2s" },
  { left: "72%", top: "62%", size: 170, op: 0.2, dx: "-12px", dy: "10px", dur: "10s", delay: "0.4s" },
  { left: "42%", top: "82%", size: 210, op: 0.18, dx: "8px", dy: "-12px", dur: "11s", delay: "1.1s" },
]

const FEATURE_CARDS = [
  {
    title: "Curated Library",
    description: "Keep your collection organized with rich metadata, covers, tags, and upload history.",
    icon: Library,
    step: "01",
  },
  {
    title: "AI Reading Insights",
    description: "Generate concise summaries, key takeaways, and structured notes from your books.",
    icon: Brain,
    step: "02",
  },
  {
    title: "Private By Default",
    description: "Each reader sees only their own uploads, notes, highlights, and reading progress.",
    icon: ShieldCheck,
    step: "03",
  },
]

export default function HomePage() {
  const [latestBooks, setLatestBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void fetchLatestBooks()
  }, [])

  const fetchLatestBooks = async () => {
    try {
      const response = await fetch("/api/books?page=1&pageSize=6", {
        cache: "no-store",
      })
      const result = await response.json().catch(() => null)

      if (!response.ok || !result?.success) {
        throw new Error(result?.details || result?.error || "Failed to fetch books")
      }

      setLatestBooks((result.books || []) as Book[])
    } catch (error) {
      console.error("Error fetching latest books:", error)
      setLatestBooks([])
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    if (loading) {
      return [
        { label: "Latest Uploads", value: "--" },
        { label: "Books Indexed", value: "--" },
        { label: "Reading Ready", value: "--" },
      ]
    }

    return [
      { label: "Latest Uploads", value: String(latestBooks.length) },
      { label: "Books Indexed", value: `${latestBooks.length}+` },
      { label: "Reading Ready", value: "24/7" },
    ]
  }, [loading, latestBooks])

  return (
    <div
      className={`${jost.variable} ${playfair.variable} ${cormorant.variable} relative min-h-screen overflow-x-hidden bg-[#eef5f0] text-[#2c3e30]`}
    >
      <div aria-hidden className="home-mesh pointer-events-none fixed inset-0 -z-20" />

      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {BOKEH_DOTS.map((dot, index) => (
          <span
            key={`${dot.left}-${dot.top}-${index}`}
            className="home-bokeh absolute rounded-full"
            style={
              {
                left: dot.left,
                top: dot.top,
                width: `${dot.size}px`,
                height: `${dot.size}px`,
                "--op": dot.op,
                "--dx": dot.dx,
                "--dy": dot.dy,
                "--dur": dot.dur,
                "--delay": dot.delay,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-20 pt-10 md:px-8 md:pt-14">
        <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#7aaa8750] bg-[#7aaa8718] px-4 py-2 text-xs tracking-[0.2em] text-[#4a7c5a] uppercase">
              <span className="h-2 w-2 rounded-full bg-[#7aaa87] animate-pulse" />
              Future Reading, Grounded
            </div>

            <h1 className="mt-6 text-4xl leading-tight text-[#2c3e30] md:text-6xl [font-family:var(--font-home-serif)]">
              Book365 for a
              <span className="block italic text-[#4a7c5a]">Calmer Reading Life</span>
            </h1>

            <p className="mt-5 max-w-xl text-base leading-8 text-[#5d7766] md:text-lg">
              Build a private digital library, keep your notes in one place, and get AI-assisted summaries with a
              clean, low-distraction reading workflow.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/upload"
                className="inline-flex items-center rounded-sm bg-[#4a7c5a] px-6 py-3 text-xs font-medium tracking-[0.18em] text-white uppercase shadow-[0_12px_28px_rgba(74,124,90,0.25)] transition hover:bg-[#2d5038]"
              >
                Upload a Book
              </Link>
              <Link
                href="/books"
                className="inline-flex items-center gap-2 text-sm font-medium text-[#4a7c5a] transition hover:gap-3 hover:text-[#2d5038]"
              >
                Explore Library
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="home-float relative rounded-3xl border border-[#b2cebb80] bg-gradient-to-br from-white/90 to-[#d6e8dc]/65 p-7 shadow-[0_24px_80px_rgba(74,124,90,0.14)] backdrop-blur-xl">
              <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_20%_20%,rgba(178,206,187,0.35),transparent_55%)]" />
              <div className="relative mx-auto flex min-h-[420px] max-w-[360px] flex-col items-center justify-center rounded-3xl border border-[#b2cebb80] bg-white/65 px-6 py-10 text-center shadow-[0_10px_35px_rgba(74,124,90,0.1)] backdrop-blur">
                <svg className="constellation-spin h-52 w-52" viewBox="0 0 200 200" fill="none" aria-hidden>
                  <polygon points="100,20 160,70 140,140 60,140 40,70" stroke="rgba(74,124,90,0.3)" strokeWidth="1.1" />
                  <circle cx="100" cy="20" r="4" fill="rgba(122,170,135,0.65)" />
                  <circle cx="160" cy="70" r="3" fill="rgba(122,170,135,0.55)" />
                  <circle cx="140" cy="140" r="3.5" fill="rgba(122,170,135,0.58)" />
                  <circle cx="60" cy="140" r="3" fill="rgba(122,170,135,0.55)" />
                  <circle cx="40" cy="70" r="4" fill="rgba(122,170,135,0.65)" />
                  <circle cx="100" cy="100" r="6" fill="rgba(74,124,90,0.25)" stroke="rgba(74,124,90,0.4)" strokeWidth="1" />
                  <line x1="100" y1="20" x2="100" y2="100" stroke="rgba(74,124,90,0.16)" strokeWidth="0.9" />
                  <line x1="160" y1="70" x2="100" y2="100" stroke="rgba(74,124,90,0.16)" strokeWidth="0.9" />
                  <line x1="140" y1="140" x2="100" y2="100" stroke="rgba(74,124,90,0.16)" strokeWidth="0.9" />
                  <line x1="60" y1="140" x2="100" y2="100" stroke="rgba(74,124,90,0.16)" strokeWidth="0.9" />
                  <line x1="40" y1="70" x2="100" y2="100" stroke="rgba(74,124,90,0.16)" strokeWidth="0.9" />
                  <circle cx="100" cy="100" r="70" stroke="rgba(122,170,135,0.13)" strokeWidth="1" strokeDasharray="3 5" />
                  <circle cx="100" cy="100" r="50" stroke="rgba(122,170,135,0.1)" strokeWidth="0.8" strokeDasharray="2 6" />
                </svg>
                <p className="mt-2 text-2xl italic text-[#4a7c5a] [font-family:var(--font-home-serif)]">Reading Constellation</p>
                <p className="mt-1 text-[11px] tracking-[0.2em] text-[#6f8d7a] uppercase">Focused Learning Path</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <span className="rounded-full border border-[#7aaa8740] bg-[#7aaa871f] px-3 py-1 text-[11px] tracking-[0.08em] text-[#4a7c5a] uppercase">
                    Summaries
                  </span>
                  <span className="rounded-full border border-[#7aaa8740] bg-[#7aaa871f] px-3 py-1 text-[11px] tracking-[0.08em] text-[#4a7c5a] uppercase">
                    Notes
                  </span>
                  <span className="rounded-full border border-[#7aaa8740] bg-[#7aaa871f] px-3 py-1 text-[11px] tracking-[0.08em] text-[#4a7c5a] uppercase">
                    Highlights
                  </span>
                </div>
              </div>
            </div>

            <div className="absolute -right-3 top-4 rounded-xl border border-[#b2cebb80] bg-white/85 px-3 py-2 text-xs text-[#4d6655] shadow-[0_8px_28px_rgba(74,124,90,0.1)] backdrop-blur">
              <p className="uppercase tracking-[0.14em]">Reader Mode</p>
              <p className="[font-family:var(--font-home-serif)] text-base text-[#2d5038]">Active</p>
            </div>

            <div className="absolute -left-3 bottom-8 rounded-xl border border-[#b2cebb80] bg-white/85 px-3 py-2 text-xs text-[#4d6655] shadow-[0_8px_28px_rgba(74,124,90,0.1)] backdrop-blur">
              <p className="uppercase tracking-[0.14em]">Latest Title</p>
              <p className="max-w-[160px] truncate [font-family:var(--font-home-serif)] text-base text-[#2d5038]">
                {latestBooks[0]?.title || "Your next read"}
              </p>
            </div>
          </div>
        </section>

        <section className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-[#b2cebb66] bg-white/65 shadow-[0_4px_30px_rgba(74,124,90,0.08)] backdrop-blur lg:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white/50 px-6 py-5 text-center">
              <p className="text-3xl text-[#4a7c5a] [font-family:var(--font-home-serif)]">{stat.value}</p>
              <p className="mt-1 text-xs tracking-[0.16em] text-[#6f8d7a] uppercase">{stat.label}</p>
            </div>
          ))}
        </section>

        <section className="mt-14 rounded-2xl border border-[#b2cebb66] bg-white/60 p-4 shadow-[0_4px_30px_rgba(74,124,90,0.08)] backdrop-blur md:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-3xl text-[#2c3e30] [font-family:var(--font-home-serif)]">Latest Books Added</h2>
            <Button
              asChild
              variant="outline"
              className="border-[#7aaa8750] bg-white/70 text-[#4a7c5a] hover:bg-[#eef5f0] hover:text-[#2d5038]"
            >
              <Link href="/books">View Full Library</Link>
            </Button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-14 animate-pulse rounded-xl bg-[#d6e8dc]" />
              ))}
            </div>
          ) : latestBooks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[#7aaa8750] bg-[#eef5f0] p-10 text-center">
              <BookOpen className="mx-auto h-10 w-10 text-[#7aaa87]" />
              <p className="mt-3 text-[#4d6655]">No books yet. Upload your first title to begin.</p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="overflow-x-auto rounded-xl border border-[#b2cebb66] bg-white/70">
                <table className="w-full min-w-[620px] text-left">
                  <thead>
                    <tr className="border-b border-[#b2cebb66] text-xs tracking-[0.14em] text-[#6f8d7a] uppercase">
                      <th className="px-4 py-3 font-medium">Title</th>
                      <th className="px-4 py-3 font-medium">Author</th>
                      <th className="px-4 py-3 font-medium">Added</th>
                      <th className="px-4 py-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {latestBooks.map((book) => (
                      <tr key={book.id} className="border-b border-[#b2cebb44] last:border-0">
                        <td className="px-4 py-3">
                          <p className="text-base text-[#2c3e30]">{book.title || "Untitled"}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#5d7766]">{book.author || "Unknown Author"}</td>
                        <td className="px-4 py-3 text-sm text-[#5d7766]">
                          {book.created_at ? new Date(book.created_at).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <Link href={`/books/${book.id}`} className="text-sm font-medium text-[#4a7c5a] hover:text-[#2d5038]">
                            Open
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {latestBooks.slice(0, 3).map((book) => (
                  <Link
                    key={`tile-${book.id}`}
                    href={`/books/${book.id}`}
                    className="group overflow-hidden rounded-xl border border-[#b2cebb66] bg-white/75 shadow-[0_6px_24px_rgba(74,124,90,0.08)] transition hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(74,124,90,0.15)]"
                  >
                    <div className="relative aspect-[3/2]">
                      <Image
                        src={book.cover_url || "/abstract-book-cover.png"}
                        alt={book.title || "Book cover"}
                        fill
                        className="object-cover transition group-hover:scale-[1.03]"
                        sizes="(max-width: 1024px) 50vw, 33vw"
                        onError={(e) => {
                          e.currentTarget.src = "/abstract-book-cover.png"
                        }}
                      />
                    </div>
                    <div className="p-4">
                      <p className="line-clamp-1 text-lg text-[#2c3e30] [font-family:var(--font-home-serif)]">{book.title}</p>
                      <p className="mt-1 line-clamp-1 text-sm text-[#5d7766]">{book.author || "Unknown Author"}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-14">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs tracking-[0.2em] text-[#6f8d7a] uppercase">Book365 Core</p>
              <h3 className="mt-2 text-4xl text-[#2c3e30] [font-family:var(--font-home-serif)]">
                Quiet tools, <span className="italic text-[#4a7c5a]">serious reading</span>
              </h3>
            </div>
            <p className="max-w-md text-sm leading-7 text-[#5d7766]">
              This theme applies your requested sage palette and typography while keeping your existing Book365 features.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {FEATURE_CARDS.map((feature) => (
              <div
                key={feature.title}
                className="rounded-2xl border border-[#b2cebb66] bg-white/65 p-6 shadow-[0_6px_24px_rgba(74,124,90,0.08)] transition hover:-translate-y-1 hover:shadow-[0_12px_30px_rgba(74,124,90,0.15)]"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#d6e8dc] text-[#4a7c5a]">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <span className="text-xs italic text-[#7aaa87] [font-family:var(--font-home-serif)]">{feature.step}</span>
                </div>
                <h4 className="text-xl text-[#2c3e30] [font-family:var(--font-home-serif)]">{feature.title}</h4>
                <p className="mt-2 text-sm leading-7 text-[#5d7766]">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-14 rounded-2xl border border-[#b2cebb66] bg-gradient-to-br from-[#d6e8dc66] via-[#eef5f0cc] to-[#b2cebb33] p-8 text-center shadow-[0_6px_24px_rgba(74,124,90,0.08)]">
          <p className="mx-auto max-w-3xl text-3xl leading-relaxed text-[#2c3e30] md:text-4xl [font-family:var(--font-home-quote)]">
            "A focused interface makes reading feel intentional. Book365 gives structure without noise."
          </p>
          <p className="mt-4 text-sm tracking-[0.16em] text-[#6f8d7a] uppercase">Reader Feedback</p>
        </section>

        <section className="mt-14 grid gap-8 rounded-2xl border border-[#b2cebb66] bg-white/60 p-6 shadow-[0_6px_24px_rgba(74,124,90,0.08)] md:grid-cols-2 md:p-8">
          <div>
            <h3 className="text-4xl leading-tight text-[#2c3e30] [font-family:var(--font-home-serif)]">
              Ready to build your <span className="italic text-[#4a7c5a]">next reading cycle</span>?
            </h3>
            <p className="mt-4 text-sm leading-7 text-[#5d7766]">
              Upload books, keep notes, and use AI summaries in one workflow optimized for focus.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-3">
            <Button asChild className="h-11 bg-[#4a7c5a] text-white hover:bg-[#2d5038]">
              <Link href="/register">Create Your Library</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-11 border-[#7aaa8750] bg-white/70 text-[#4a7c5a] hover:bg-[#eef5f0] hover:text-[#2d5038]"
            >
              <Link href="/reading-list">Open Reading List</Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#b2cebb66] bg-[#2d5038] px-4 py-10 text-[#d6e8dc] md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
          <div>
            <p className="text-2xl [font-family:var(--font-home-serif)]">Book365</p>
            <p className="mt-1 text-sm text-[#b2cebb]">Future-ready reading for modern teams and individuals.</p>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-[#d6e8dc]">
            <Link href="/books" className="hover:text-white">
              Books
            </Link>
            <Link href="/upload" className="hover:text-white">
              Upload
            </Link>
            <Link href="/reading-list" className="hover:text-white">
              Reading List
            </Link>
            <Link href="/notes" className="hover:text-white">
              Study Notes
            </Link>
          </div>
        </div>
      </footer>

      <style jsx>{`
        .home-mesh {
          background:
            radial-gradient(ellipse 60% 50% at 20% 20%, rgba(178, 206, 187, 0.48) 0%, transparent 60%),
            radial-gradient(ellipse 50% 60% at 80% 10%, rgba(214, 232, 220, 0.62) 0%, transparent 55%),
            radial-gradient(ellipse 70% 40% at 50% 100%, rgba(122, 170, 135, 0.22) 0%, transparent 60%),
            linear-gradient(165deg, #eef5f0 0%, #d8ecdf 40%, #eaf3ec 100%);
        }
        .home-bokeh {
          background: radial-gradient(circle, rgba(255, 255, 255, 0.88) 0%, rgba(255, 255, 255, 0) 70%);
          animation: homeFloat var(--dur) ease-in-out var(--delay) infinite alternate;
          opacity: var(--op);
        }
        .home-float {
          animation: panelFloat 5s ease-in-out infinite;
        }
        .constellation-spin {
          animation: rotateSlow 32s linear infinite;
        }
        @keyframes homeFloat {
          from {
            transform: translate(0, 0) scale(1);
          }
          to {
            transform: translate(var(--dx), var(--dy)) scale(1.08);
          }
        }
        @keyframes panelFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-8px);
          }
        }
        @keyframes rotateSlow {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  )
}
