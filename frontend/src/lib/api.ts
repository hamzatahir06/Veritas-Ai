export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

/** The Supabase JWT, as the API expects it. */
export const authHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` })

/** Headers for a JSON body, signed in when a token is given. */
export const jsonHeaders = (accessToken?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(accessToken ? authHeader(accessToken) : {}),
})

/**
 * Turns a non-2xx response into an Error. FastAPI puts a user-readable message
 * in `detail` for the errors we raise ("Project not found"); validation errors
 * carry a list there instead, which is no use to a reader, so `fallback` wins.
 */
export async function fail(res: Response, fallback: string): Promise<never> {
  const detail = (await res.json().catch(() => null))?.detail
  throw new Error(typeof detail === 'string' ? detail : fallback)
}

/** A signed-in endpoint's JSON; a non-2xx response throws (see `fail`). */
export async function getJson<T>(
  path: string, accessToken: string, fallbackError: string, signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeader(accessToken), signal })
  if (!res.ok) await fail(res, fallbackError)
  return res.json()
}

export type Source = {
  query: string
  title: string
  url: string
  snippet: string
  // Reference metadata the document writers use; absent on older saved rows.
  authors?: string
  venue?: string
  published?: string
  kind?: string
}

export type StreamEvent =
  | { type: 'planning' }
  | { type: 'searching'; query: string }
  // `sources` is optional so an older backend (or a cached bundle) that omits
  // it degrades to the plain, unclickable count rather than breaking.
  | { type: 'found'; query: string; count: number; sources?: { title: string; url: string }[] }
  | { type: 'limit_reached' }
  | { type: 'provider_failed'; provider: string; error: string }
  | { type: 'save_failed'; error: string }
  | { type: 'chat_reply'; message: string }
  | { type: 'error'; message: string }
  | {
      type: 'done'
      project_id: string | null
      saved: boolean
      topic: string
      markdown: string
      sources: Source[]
      provider: string
    }

export type DoneEvent = Extract<StreamEvent, { type: 'done' }>

/**
 * Join the Pro waitlist. Pass `accessToken` for a signed-in user (the backend
 * takes their email + id from the token); pass `email` for a signed-out visitor.
 * `added` is false when the address was already on the list.
 */
export async function joinWaitlist(
  opts: { email?: string; accessToken?: string },
): Promise<{ added: boolean }> {
  const res = await fetch(`${API_BASE}/api/waitlist`, {
    method: 'POST',
    headers: jsonHeaders(opts.accessToken),
    body: JSON.stringify(opts.email ? { email: opts.email } : {}),
  })
  if (!res.ok) await fail(res, 'Could not join the waitlist — please try again.')
  return res.json()
}

/** Permanently deletes the signed-in account; `email` must match it (checked server-side too). */
export async function deleteAccount(email: string, accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/me`, {
    method: 'DELETE',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ email }),
  })
  if (!res.ok) await fail(res, 'Could not delete your account — please try again.')
}

export async function* streamResearch(
  topic: string,
  accessToken?: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const res = await fetch(`${API_BASE}/api/research`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ topic }),
    signal,
  })
  // A rejected request (validation, server error) answers with JSON, not a
  // stream; without this the reader would find no frames and end silently.
  if (!res.ok) await fail(res, `Research request failed (${res.status}).`)
  if (!res.body) throw new Error('No response stream from server.')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const frames = buffer.split('\n\n')
    buffer = frames.pop() || ''

    for (const frame of frames) {
      if (frame.startsWith('data: ')) yield JSON.parse(frame.slice(6)) as StreamEvent
    }
  }
}
