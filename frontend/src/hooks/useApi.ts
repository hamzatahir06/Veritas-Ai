import { useEffect, useState } from 'react'
import { getJson } from '../lib/api'

type Result<T> = { path: string; data?: T; error?: string }

/**
 * One signed-in GET as page state: `loading` until it resolves, then `data` or
 * `error`. Changing `path` starts a new request and aborts the old one, so a
 * late response can never show the previous page's data; a token refresh
 * re-fetches the same path with the current data still on screen.
 */
export function useApi<T>(path: string, accessToken: string | undefined, fallbackError: string) {
  const [result, setResult] = useState<Result<T>>()

  useEffect(() => {
    if (!accessToken) return
    const controller = new AbortController()
    getJson<T>(path, accessToken, fallbackError, controller.signal)
      .then((data) => setResult({ path, data }))
      .catch((err: Error) => {
        if (!controller.signal.aborted) setResult({ path, error: err.message })
      })
    return () => controller.abort()
  }, [path, accessToken, fallbackError])

  // A result for another path is stale: treat it as still loading.
  const current = result?.path === path ? result : undefined
  const setData = (update: (prev: T) => T) =>
    setResult((prev) => (prev?.data === undefined ? prev : { ...prev, data: update(prev.data) }))

  return { data: current?.data, error: current?.error, loading: !current, setData }
}
