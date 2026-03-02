import { useEffect, useState } from 'react'
import { ServiceStatus } from './components/ServiceStatus'
import type { HeartbeatResult } from './services/heartbeat'

type LoadState = 'loading' | 'error' | 'ready'

export function App() {
  const [results, setResults] = useState<HeartbeatResult[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')

  useEffect(() => {
    async function refresh() {
      try {
        const response = await fetch('/api/status')
        const data: HeartbeatResult[] = await response.json()
        setResults(data)
        setLoadState('ready')
      } catch {
        setLoadState('error')
      }
    }

    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <main>
      <h1>nakomis status</h1>
      {loadState === 'loading' && <p>Loading…</p>}
      {loadState === 'error' && <p>Unable to fetch status.</p>}
      {loadState === 'ready' && results.map((result) => (
        <ServiceStatus key={result.service} {...result} />
      ))}
    </main>
  )
}
