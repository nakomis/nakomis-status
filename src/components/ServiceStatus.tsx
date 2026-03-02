import type { HeartbeatResult } from '../services/heartbeat'

type Props = Pick<HeartbeatResult, 'service' | 'status' | 'latencyMs'>

export function ServiceStatus({ service, status, latencyMs }: Props) {
  return (
    <div className="service-status">
      <span className="service-name">{service}</span>
      <span data-testid="status-indicator" className={`status-indicator status-${status}`}>
        {status}
      </span>
      {latencyMs !== undefined && (
        <span className="latency">{latencyMs}ms</span>
      )}
    </div>
  )
}
