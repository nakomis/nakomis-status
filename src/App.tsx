import { useEffect, useState } from 'react'
import { ServiceStatus } from './components/ServiceStatus'
import type { HeartbeatResult } from './services/heartbeat'
import './App.css'

type LoadState = 'loading' | 'error' | 'ready'

function getBanner(results: HeartbeatResult[]): { label: string; modifier: string } {
  if (results.every(r => r.status === 'up')) {
    return { label: 'All systems operational', modifier: 'operational' }
  }
  if (results.some(r => r.status === 'down')) {
    return { label: 'Degraded performance', modifier: 'degraded' }
  }
  return { label: 'Partial outage', modifier: 'partial' }
}

export function App() {
  const [results, setResults] = useState<HeartbeatResult[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    async function refresh() {
      try {
        const response = await fetch('/api/status')
        const data: HeartbeatResult[] = await response.json()
        setResults(data)
        setLoadState('ready')
        setLastUpdated(
          new Date().toLocaleTimeString('en-GB', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })
        )
      } catch {
        setLoadState('error')
      }
    }

    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [])

  const banner = loadState === 'ready' ? getBanner(results) : null

  return (
    <main>
      <header className="page-header">
        <h1 className="page-title">
          nakomis<span className="page-title__accent">.</span>
        </h1>
        <p className="page-subtitle">service status</p>
      </header>

      {banner && (
        <div className={`status-banner status-banner--${banner.modifier}`}>
          <span className="status-banner__dot" />
          {banner.label}
        </div>
      )}

      {loadState === 'loading' && <p className="state-message">Checking services…</p>}
      {loadState === 'error' && <p className="state-message">Unable to fetch status.</p>}
      {loadState === 'ready' && (
        <div className="services-list">
          {results.map((result) => (
            <ServiceStatus key={result.service} {...result} />
          ))}
        </div>
      )}

      {lastUpdated && <p className="page-footer">updated {lastUpdated}</p>}
    </main>
  )
}
