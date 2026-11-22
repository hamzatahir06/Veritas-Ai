import { Component, type ErrorInfo, type ReactNode } from 'react'
import PageMessage from './PageMessage'

/**
 * Catches a page that throws while rendering — or a code-split chunk that no
 * longer exists after a deploy — so the shell stays up with a way out instead
 * of a blank screen. Layout keys it by path, so navigating away resets it.
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <PageMessage error>
        This page couldn't load.{' '}
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="cursor-pointer font-semibold underline decoration-red-300 hover:decoration-red-600"
        >
          Reload
        </button>
      </PageMessage>
    )
  }
}
