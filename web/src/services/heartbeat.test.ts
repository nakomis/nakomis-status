import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkHeartbeat } from './heartbeat'

describe('checkHeartbeat', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('returns up when endpoint responds with 200', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.status).toBe('up')
    expect(result.service).toBe('nakom.is')
    expect(result.url).toBe('https://nakom.is')
  })

  it('returns down when endpoint responds with non-2xx', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.status).toBe('down')
  })

  it('returns down when fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.status).toBe('down')
  })

  it('returns down when fetch times out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError')))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.status).toBe('down')
  })

  it('includes latency for successful responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const result = await checkHeartbeat('nakom.is', 'https://nakom.is')
    expect(result.latencyMs).toBeTypeOf('number')
    expect(result.latencyMs).toBeGreaterThanOrEqual(0)
  })
})
