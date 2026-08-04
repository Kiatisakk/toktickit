import { useState } from 'react'

import { fetchHealth } from './api'

/**
 * The System Status shown here is a verdict about the whole vertical slice, not
 * the result of a single endpoint. Issue 2 checks the API; Issue 4 adds the
 * database leg. See CONTEXT.md.
 */
type CheckState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'online' }
  | { kind: 'offline'; message: string }

export default function App() {
  const [state, setState] = useState<CheckState>({ kind: 'idle' })

  async function checkSystem() {
    setState({ kind: 'loading' })

    try {
      await fetchHealth()
      setState({ kind: 'online' })
    } catch (error) {
      setState({
        kind: 'offline',
        message:
          error instanceof Error
            ? error.message
            : 'Unable to connect to TokTickIT API',
      })
    }
  }

  return (
    <main className="container py-5" style={{ maxWidth: '48rem' }}>
      <h1 className="h3 mb-4">TokTickIT IT Service Desk</h1>

      <button
        type="button"
        className="btn btn-primary"
        onClick={checkSystem}
        disabled={state.kind === 'loading'}
      >
        Check System
      </button>

      {state.kind === 'loading' && (
        <p className="mt-4 mb-0" role="status">
          <span aria-hidden="true">⏳</span> Loading…
        </p>
      )}

      {state.kind === 'online' && (
        <p className="mt-4 mb-0">
          System Status: <span className="badge text-bg-success">Online</span>
        </p>
      )}

      {state.kind === 'offline' && (
        <div className="mt-4">
          <p className="mb-2">
            System Status: <span className="badge text-bg-danger">Offline</span>
          </p>
          <div className="alert alert-danger mb-0" role="alert">
            {state.message}
          </div>
        </div>
      )}
    </main>
  )
}
