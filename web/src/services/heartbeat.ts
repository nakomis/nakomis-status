export interface HeartbeatResult {
  service: string
  url: string
  status: 'up' | 'down' | 'unknown' | 'warning'
  latencyMs?: number
  detail?: string
}

export async function checkHeartbeat(service: string, url: string): Promise<HeartbeatResult> {
  const start = Date.now()
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return {
      service,
      url,
      status: response.ok ? 'up' : 'down',
      latencyMs: Date.now() - start,
    }
  } catch {
    return { service, url, status: 'down' }
  }
}
