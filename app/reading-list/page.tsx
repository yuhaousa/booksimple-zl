"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BookOpen, Trash2, Calendar, User, Building, ExternalLink, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { toast } from "sonner"


interface ReadingListItem {
  id: number;
  book_id: number;
  added_at: string;
  status: 'to_read' | 'reading' | 'completed';
  book: {
    id: number;
    title: string;
    author: string | null;
    publisher: string | null;
    year: number | null;
    cover_url: string | null;
    file_url: string | null;
    description: string | null;
    tags: string | null;
    user_id?: string;
  };
}

const STATUS_COLORS = {
  to_read: 'default',
  reading: 'secondary',
  completed: 'outline',
} as const;

const STATUS_LABELS = {
  to_read: 'To Read',
  reading: 'Currently Reading',
  completed: 'Completed',
};

const ITEMS_PER_PAGE = 12;

export default function ReadingListPage() {
  const [readingList, setReadingList] = useState<ReadingListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'to_read' | 'reading' | 'completed'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserAndList = async () => {
      const { data } = await supabase.auth.getUser();
      if (!data?.user) {
        setUser(null);
        setLoading(false);
        return;
      }
      setUser(data.user);

      try {
        const { data: listData, error } = await supabase
          .from('reading_list')
          .select(`
            id,
            status,
            added_at,
            user_id,
            book:Booklist!book_id (
              id,
              title,
              author,
              publisher,
              year,
              cover_url,
              file_url,
              description,
              tags,
              user_id
            )
          `)
          .order('added_at', { ascending: false });

        if (error) throw error;

        if (error) throw error;

        // Generate signed URLs for covers and files (no additional filtering needed)
        const listWithSignedUrls = await Promise.all(
          (listData || []).map(async (item: ReadingListItem) => {
            let coverUrl = item.book.cover_url;
            let fileUrl = item.book.file_url;

            if (coverUrl) {
              const { data: signedCover, error: coverError } = await supabase.storage
                .from('book-cover')
                .createSignedUrl(coverUrl.replace(/^book-cover\//, ''), 60 * 60 * 24);
              if (!coverError && signedCover?.signedUrl) {
                coverUrl = signedCover.signedUrl;
              }
            }

            if (fileUrl) {
              const { data: signedFile, error: fileError } = await supabase.storage
                .from('book-file')
                .createSignedUrl(fileUrl.replace(/^book-file\//, ''), 60 * 60 * 24);
              if (!fileError && signedFile?.signedUrl) {
                fileUrl = signedFile.signedUrl;
              }
            }

            return {
              ...item,
              book: { ...item.book, cover_url: coverUrl, file_url: fileUrl },
            };
          })
        );

        setReadingList(listWithSignedUrls);
      } catch (error) {
        console.error('Error fetching reading list:', error);
        toast.error('Failed to load reading list');
      } finally {
        setLoading(false);
      }
    };
    fetchUserAndList();
  }, []);

  if (!loading && !user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Please log in to view your reading list.</h3>
            <Button asChild>
              <Link href="/login">Login</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const removeFromReadingList = async (itemId: number) => {
    if (!confirm('Are you sure you want to remove this book from your reading list?')) return;

    try {
      const { error } = await supabase
        .from('reading_list')
        .delete()
        .eq('id', itemId);

      if (error) throw error;

      toast.success('Book removed from reading list');
      setReadingList((prev: ReadingListItem[]) => prev.filter((item: ReadingListItem) => item.id !== itemId));
    } catch (error) {
      console.error('Error removing from reading list:', error);
      toast.error('Failed to remove book from reading list');
    }
  };

  const updateStatus = async (itemId: number, newStatus: ReadingListItem['status']) => {
    try {
      const { error } = await supabase
        .from('reading_list')
        .update({ status: newStatus })
        .eq('id', itemId);

      if (error) throw error;

      toast.success(`Status updated to ${STATUS_LABELS[newStatus]}`);
      setReadingList((prev: ReadingListItem[]) => prev.map((item: ReadingListItem) =>
        item.id === itemId ? { ...item, status: newStatus } : item
      ));
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const filteredList = readingList.filter((item: ReadingListItem) =>
    filter === 'all' || item.status === filter
  );

  // Pagination logic
  const totalItems = filteredList.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedList = filteredList.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (newFilter: 'all' | 'to_read' | 'reading' | 'completed') => {
    setFilter(newFilter);
    setCurrentPage(1); // Reset to first page when filter changes
  };

  const getStatusCounts = () => {
    const counts = {
      all: readingList.length,
      to_read: readingList.filter((item: ReadingListItem) => item.status === 'to_read').length,
      reading: readingList.filter((item: ReadingListItem) => item.status === 'reading').length,
      completed: readingList.filter((item: ReadingListItem) => item.status === 'completed').length,
    };
    return counts;
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your reading list...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-6">
          <h1 className="text-2xl md:text-3xl font-bold text-primary text-balance">My Reading List</h1>
          <p className="text-lg text-muted-foreground mt-2">Track your reading progress and discover what's next</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.entries({
            all: 'All Books',
            to_read: 'To Read',
            reading: 'Currently Reading',
            completed: 'Completed',
          }).map(([key, label]) => (
            <Button
              key={key}
              variant={filter === key ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleFilterChange(key as typeof filter)}
              className="flex items-center gap-2"
            >
              {label}
              <Badge variant="secondary" className="text-xs">
                {statusCounts[key as keyof typeof statusCounts]}
              </Badge>
            </Button>
          ))}
        </div>

        {totalItems === 0 ? (
          <div className="text-center py-12">
            <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              {filter === 'all'
                ? 'Your reading list is empty'
                : `No books in "${Object.entries({
                    to_read: 'To Read',
                    reading: 'Currently Reading',
                    completed: 'Completed',
                  }).find(([k]) => k === filter)?.[1]}" status`}
            </h3>
            <p className="text-muted-foreground mb-4">
              {filter === 'all'
                ? 'Start adding books from your collection to track your reading progress'
                : 'Books you add to this status will appear here'}
            </p>
            <Button asChild>
              <Link href="/books">Browse Books to Add</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedList.map((item: ReadingListItem) => (
              <Card key={item.id} className="overflow-hidden hover:shadow-md transition-shadow">
                <div className="aspect-[3/4] relative bg-muted">
                  <Image
                    src={item.book.cover_url || '/placeholder.svg?height=400&width=300&query=book+cover'}
                    alt={item.book.title || 'Book cover'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      e.currentTarget.src = '/placeholder.svg?height=400&width=300&query=book+cover';
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <Badge variant={STATUS_COLORS[item.status]} className="text-xs">
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </div>
                </div>

                <CardHeader className="pb-2">
                  <CardTitle className="text-lg line-clamp-2">
                    <Link
                      href={`/books/${item.book.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {item.book.title || 'Untitled'}
                    </Link>
                  </CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {item.book.author && (
                      <div className="flex items-center gap-2">
                        <User className="w-3 h-3" />
                        <span className="line-clamp-1">{item.book.author}</span>
                      </div>
                    )}
                    {item.book.publisher && (
                      <div className="flex items-center gap-2">
                        <Building className="w-3 h-3" />
                        <span className="line-clamp-1">{item.book.publisher}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      <span>Added: {new Date(item.added_at).toLocaleDateString()}</span>
                    </div>
                  </div>

                  {item.book.description && (
                    <p className="text-base text-muted-foreground line-clamp-2">
                      {item.book.description}
                    </p>
                  )}

                  {item.book.tags && (
                    <div className="flex flex-wrap gap-1">
                      {item.book.tags.split(',').slice(0, 3).map((tag: string, index: number) => (
                        <Badge key={index} variant="outline" className="text-sm">
                          {tag.trim()}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {/* Status Update Buttons */}
                  <div className="flex flex-wrap gap-1">
                    {(['to_read', 'reading', 'completed'] as const).map((status) => (
                      <Button
                        key={status}
                        variant={item.status === status ? 'default' : 'outline'}
                        size="sm"
                        className="text-sm flex-1"
                        onClick={() => {
                          if (item.status === status && item.book.file_url) {
                            // If current status is clicked and book has a file, open it
                            window.open(item.book.file_url, '_blank');
                          } else {
                            // Otherwise, update the status
                            updateStatus(item.id, status);
                          }
                        }}
                      >
                        {STATUS_LABELS[status]}
                      </Button>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" asChild>
                      <Link href={`/books/${item.book.id}`}>
                        <ExternalLink className="w-3 h-3 mr-1" />
                        View Details
                      </Link>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => removeFromReadingList(item.id)}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-8">
            <div className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{Math.min(endIndex, totalItems)} of {totalItems} books
              {totalPages > 1 && (
                <span className="ml-2">
                  (Page {currentPage} of {totalPages})
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNumber
                  if (totalPages <= 5) {
                    pageNumber = i + 1
                  } else if (currentPage <= 3) {
                    pageNumber = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNumber = totalPages - 4 + i
                  } else {
                    pageNumber = currentPage - 2 + i
                  }

                  return (
                    <Button
                      key={pageNumber}
                      variant={currentPage === pageNumber ? "default" : "outline"}
                      size="sm"
                      onClick={() => handlePageChange(pageNumber)}
                      className="min-w-[2.5rem]"
                    >
                      {pageNumber}
                    </Button>
                  )
                })}
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
