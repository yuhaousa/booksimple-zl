'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'

export default function TestProgressPage() {
  const [user, setUser] = useState<any>(null)
  const [trackingData, setTrackingData] = useState<any[]>([])
  const [testResult, setTestResult] = useState<string>('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)

    if (user) {
      const { data, error } = await supabase
        .from('book_tracking')
        .select('*')
        .eq('user_id', user.id)
      
      if (error) {
        console.error('Error loading tracking data:', error)
        setTestResult(`Error loading data: ${error.message}`)
      } else {
        setTrackingData(data || [])
        setTestResult(`Found ${data?.length || 0} tracking records`)
      }
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
      const { data: books, error: bookError } = await supabase
        .from('Booklist')
        .select('id, title')
        .limit(1)
      
      if (bookError || !books || books.length === 0) {
        setTestResult('No books found in your library. Please upload a book first.')
        setLoading(false)
        return
      }

      const testBookId = books[0].id
      setTestResult(`Testing with book: "${books[0].title}" (ID: ${testBookId})...`)

      // Test with the actual book ID, page 10 of 100
      const { data, error } = await supabase.rpc('update_reading_progress', {
        p_user_id: user.id,
        p_book_id: testBookId,
        p_current_page: 10,
        p_total_pages: 100
      })

      if (error) {
        setTestResult(`RPC Error: ${error.message}`)
        console.error('RPC Error:', error)
      } else {
        setTestResult(`RPC function executed successfully for "${books[0].title}"!`)
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
