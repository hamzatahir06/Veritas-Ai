export const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'

/** The Supabase JWT, as the API expects it. */
export const authHeader = (accessToken: string) => ({ Authorization: `Bearer ${accessToken}` })

/** Headers for a JSON body, signed in when a token is given. */
export const jsonHeaders = (accessToken?: string): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...(accessToken ? authHeader(accessToken) : {}),
})

/** GET a signed-in endpoint's JSON; a non-2xx response throws `errorMessage`. */
export async function getJson<T>(path: string, accessToken: string, errorMessage: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { headers: authHeader(accessToken) })
  if (!res.ok) throw new Error(errorMessage)
  return res.json()
}

export type StreamEvent =
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
      sources: { query: string; title: string; url: string; snippet: string }[]
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
  const response = await fetch(`${API_BASE}/api/waitlist`, {
    method: 'POST',
    headers: jsonHeaders(opts.accessToken),
    body: JSON.stringify(opts.email ? { email: opts.email } : {}),
  })

  if (!response.ok) throw new Error(`Waitlist request failed (${response.status})`)
  return response.json()
}

/** Permanently deletes the signed-in account; `email` must match it (checked server-side too). */
export async function deleteAccount(email: string, accessToken: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/me`, {
    method: 'DELETE',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ email }),
  })
  if (!response.ok) throw new Error('Could not delete your account — please try again.')
}

export async function* streamResearch(
  topic: string,
  accessToken?: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await fetch(`${API_BASE}/api/research`, {
    method: 'POST',
    headers: jsonHeaders(accessToken),
    body: JSON.stringify({ topic }),
    signal,
  })

  if (!response.body) throw new Error('No response stream from server.')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n\n')
    buffer = lines.pop() || ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      yield JSON.parse(line.slice(6)) as StreamEvent
    }
  }
}
