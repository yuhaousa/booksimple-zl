// Test page for AI analysis caching
// Visit /test-ai-cache to debug the caching system

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TestAICachePage() {
  const [bookId, setBookId] = useState('52') // Default to your test book
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const testGET = async () => {
    setLoading(true)
    addLog('🔍 Testing GET (cached analysis)...')
    
    try {
      const response = await fetch(`/api/books/${bookId}/ai-analysis`, {
        method: 'GET',
      })
      
      const data = await response.json()
      addLog(`📊 GET Response: ${response.status} ${response.statusText}`)
      
      if (data.fromCache) {
        addLog('✅ Found cached analysis!')
      } else {
        addLog('❌ No cached analysis found')
      }
      
      setResult(data)
    } catch (error) {
      addLog(`❌ GET Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const testPOST = async () => {
    setLoading(true)
    addLog('🚀 Testing POST (generate/cache analysis)...')
    
    try {
      const response = await fetch(`/api/books/${bookId}/ai-analysis`, {
        method: 'POST',
      })
      
      const data = await response.json()
      addLog(`📊 POST Response: ${response.status} ${response.statusText}`)
      
      if (data.fromCache) {
        addLog('✅ Returned cached analysis')
      } else if (data.success) {
        addLog('🆕 Generated new analysis and cached it')
      } else {
        addLog(`❌ Failed: ${data.error}`)
      }
      
      setResult(data)
    } catch (error) {
      addLog(`❌ POST Error: ${error}`)
    } finally {
      setLoading(false)
    }
  }

  const clearLogs = () => {
    setLogs([])
    setResult(null)
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>AI Analysis Cache Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <label>Book ID:</label>
            <input
              type="text"
              value={bookId}
              onChange={(e) => setBookId(e.target.value)}
              className="border rounded px-2 py-1"
              placeholder="Enter book ID"
            />
          </div>
          
          <div className="flex gap-2">
            <Button onClick={testGET} disabled={loading}>
              Test GET (Check Cache)
            </Button>
            <Button onClick={testPOST} disabled={loading}>
              Test POST (Generate/Cache)
            </Button>
            <Button onClick={clearLogs} variant="outline">
              Clear Logs
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded h-64 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet...</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded h-64 overflow-y-auto">
              {result ? (
                <pre className="text-sm whitespace-pre-wrap">
                  {JSON.stringify(result, null, 2)}
                </pre>
              ) : (
                <div className="text-gray-500">No response yet...</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Instructions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p><strong>Step 1:</strong> Click "Test GET" - should return "No cached analysis found"</p>
          <p><strong>Step 2:</strong> Click "Test POST" - should generate new analysis and cache it</p>
          <p><strong>Step 3:</strong> Click "Test GET" again - should return cached analysis</p>
          <p><strong>Step 4:</strong> Click "Test POST" again - should return cached analysis without calling AI</p>
          <p className="text-blue-600">Watch the browser network tab to see response times (cached should be much faster)</p>
        </CardContent>
      </Card>
    </div>
  )
}