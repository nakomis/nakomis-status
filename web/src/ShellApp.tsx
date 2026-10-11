import { App } from './App'
import './remote.css'

// The status API lives on Cloud Run, outside AWS, so the panel keeps working when AWS is having a bad day.
export const STATUS_API = 'https://status.nakom.is'

/** Module Federation entry (`status/App`) for nakomis-shell. Status needs no auth, so ShellContext is unused. */
export default function ShellApp() {
  return (
    <div className="status-remote">
      <App apiBase={STATUS_API} />
    </div>
  )
}
