'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export default function TestProgressPage() {
  const { user, loading: authLoading } = useAuth()
  const [trackingData, setTrackingData] = useState<any[]>([])
  const [testResult, setTestResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!authLoading) {
      loadData()
    }
  }, [user, authLoading])

  const loadData = async () => {
    if (user) {
      const response = await fetch('/api/book-tracking', {
        cache: 'no-store',
        headers: {
          'x-user-id': user.id,
        },
      })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        console.error('Error loading tracking data:', result)
        setTestResult(`Error loading data: ${result?.details || result?.error || 'Unknown error'}`)
      } else {
        const records = result.records || []
        setTrackingData(records)
        setTestResult(`Found ${records.length} tracking records`)
      }
    } else {
      setTrackingData([])
      setTestResult('')
    }
  }

  const testRpcFunction = async () => {
    if (!user) {
      setTestResult('No user logged in')
      return
    }

    setLoading(true)
    try {
      // First, get a real book ID from the user's library
      const booksResponse = await fetch('/api/books?page=1&pageSize=1', { cache: 'no-store' })
      const booksResult = await booksResponse.json().catch(() => null)
      if (!booksResponse.ok || !booksResult?.success || !booksResult?.books || booksResult.books.length === 0) {
        setTestResult('No books found in your library. Please upload a book first.')
        setLoading(false)
        return
      }

      const testBookId = booksResult.books[0].id
      setTestResult(`Testing with book: "${booksResult.books[0].title}" (ID: ${testBookId})...`)

      // Test with the actual book ID, page 10 of 100
      const updateResponse = await fetch('/api/book-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id,
        },
        body: JSON.stringify({
          book_id: testBookId,
          current_page: 10,
          total_pages: 100,
        }),
      })

      const updateResult = await updateResponse.json().catch(() => null)
      if (!updateResponse.ok || !updateResult?.success) {
        setTestResult(`Update Error: ${updateResult?.details || updateResult?.error || 'Unknown error'}`)
        console.error('Progress update error:', updateResult)
      } else {
        setTestResult(`Reading progress updated successfully for "${booksResult.books[0].title}"!`)
        await loadData()
      }
    } catch (err: any) {
      setTestResult(`Exception: ${err.message}`)
      console.error('Exception:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Reading Progress Test</h1>
      
      <div className="space-y-4">
        <div className="bg-card border rounded-lg p-4">
          <h2 className="font-semibold mb-2">User Info</h2>
          {user ? (
            <div>
              <p>ID: {user.id}</p>
              <p>Email: {user.email}</p>
            </div>
          ) : (
            <p>No user logged in</p>
          )}
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Tracking Records</h2>
          {trackingData.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Book ID</th>
                  <th className="text-left p-2">Current Page</th>
                  <th className="text-left p-2">Total Pages</th>
                  <th className="text-left p-2">Progress %</th>
                  <th className="text-left p-2">Last Read</th>
                </tr>
              </thead>
              <tbody>
                {trackingData.map((record) => (
                  <tr key={record.id} className="border-b">
                    <td className="p-2">{record.book_id}</td>
                    <td className="p-2">{record.current_page}</td>
                    <td className="p-2">{record.total_pages}</td>
                    <td className="p-2">{record.progress_percentage}%</td>
                    <td className="p-2">{new Date(record.last_read_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-muted-foreground">No tracking records found</p>
          )}
        </div>

        <div className="bg-card border rounded-lg p-4">
          <h2 className="font-semibold mb-2">Test RPC Function</h2>
          <Button onClick={testRpcFunction} disabled={loading || !user}>
            {loading ? 'Testing...' : 'Test update_reading_progress()'}
          </Button>
          {testResult && (
            <div className="mt-2 p-2 bg-muted rounded text-sm">
              {testResult}
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Button onClick={loadData}>Refresh Data</Button>
        </div>
      </div>
    </div>
  )
}
