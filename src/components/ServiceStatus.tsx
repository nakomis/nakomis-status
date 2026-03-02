import type { HeartbeatResult } from '../services/heartbeat'

type Props = Pick<HeartbeatResult, 'service' | 'status' | 'latencyMs'>

export function ServiceStatus({ service, status, latencyMs }: Props) {
  return (
    <div className="service-row">
      <div className="service-left">
        <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
        <span className="service-name">{service}</span>
      </div>
      <div className="service-right">
        {latencyMs !== undefined && (
          <span className="latency">{latencyMs}ms</span>
        )}
        <span data-testid="status-indicator" className={`status-indicator status-${status}`}>
          {status}
        </span>
      </div>
    </div>
  )
}
