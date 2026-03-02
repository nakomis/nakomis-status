import { useEffect, useState } from 'react'
import { ServiceStatus } from './components/ServiceStatus'
import type { HeartbeatResult } from './services/heartbeat'

export function App() {
  const [results, setResults] = useState<HeartbeatResult[]>([])

  useEffect(() => {
    async function refresh() {
      try {
        const response = await fetch('/api/status')
        const data: HeartbeatResult[] = await response.json()
        setResults(data)
      } catch {
        setResults([])
      }
    }

    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main>
      <h1>nakomis status</h1>
      {results.length === 0 ? (
        <p>Loading…</p>
      ) : (
        results.map((result) => (
          <ServiceStatus key={result.service} {...result} />
        ))
      )}
    </main>
  )
}
