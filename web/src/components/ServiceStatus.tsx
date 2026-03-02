import type { HeartbeatResult } from '../services/heartbeat'

type Props = Pick<HeartbeatResult, 'service' | 'status' | 'latencyMs' | 'detail'>

export function ServiceStatus({ service, status, latencyMs, detail }: Props) {
  return (
    <div className="service-row">
      <div className="service-left">
        <span className={`status-dot status-dot--${status}`} aria-hidden="true" />
        <div className="service-info">
          <span className="service-name">{service}</span>
          {detail && <span className="service-detail">{detail}</span>}
        </div>
      </div>
      <div className="service-right">
        {latencyMs !== undefined && <span className="latency">{latencyMs}ms</span>}
        <span data-testid="status-indicator" className={`status-indicator status-${status}`}>
          {status === 'warning' ? '⚠ warning' : status}
        </span>
      </div>
    </div>
  )
}
