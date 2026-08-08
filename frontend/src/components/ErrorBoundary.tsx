import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('UI crash:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 p-8 text-center text-zinc-100">
          <h1 className="text-lg font-semibold">Something went wrong</h1>
          <p className="max-w-md break-words text-sm text-zinc-400">
            {this.state.error.message}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
