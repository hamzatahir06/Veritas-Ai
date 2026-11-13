import { useState, useRef, useCallback } from 'react'
import { streamResearch, type DoneEvent, type StreamEvent } from '../lib/api'

type TurnStatus = 'streaming' | 'done' | 'chat' | 'error' | 'stopped'

type Turn = {
  id: string
  topic: string
  status: TurnStatus
  progress: StreamEvent[]
  result: DoneEvent | null
  chatReply: string | null
  errorMessage: string | null
  /** The brief arrived but couldn't be saved to the user's projects (non-fatal). */
  saveError: string | null
}

export function useResearchThread() {
  const [turns, setTurns] = useState<Turn[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const updateTurn = useCallback((id: string, patch: Partial<Turn>) => {
    setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
  }, [])

  const ask = useCallback(async (topic: string, accessToken?: string) => {
    const id = crypto.randomUUID()
    const controller = new AbortController()
    abortRef.current = controller

    setTurns((prev) => [
      ...prev,
      { id, topic, status: 'streaming', progress: [], result: null, chatReply: null, errorMessage: null, saveError: null },
    ])

    // A turn ends on exactly one terminal event; a stream that closes without
    // one (proxy timeout, server crash mid-run) must still end it.
    let settled = false
    const settle = (patch: Partial<Turn>) => {
      settled = true
      updateTurn(id, patch)
    }

    try {
      for await (const event of streamResearch(topic, accessToken, controller.signal)) {
        if (event.type === 'done') settle({ result: event, status: 'done' })
        else if (event.type === 'chat_reply') settle({ chatReply: event.message, status: 'chat' })
        else if (event.type === 'error') settle({ errorMessage: event.message, status: 'error' })
        else if (event.type === 'save_failed') updateTurn(id, { saveError: event.error })
        else setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, progress: [...t.progress, event] } : t)))
      }
      if (!settled) settle({ errorMessage: 'The connection closed before the brief arrived.', status: 'error' })
    } catch (err) {
      // A user-triggered abort closes the connection mid-stream — that's not
      // an error, just a cancelled run (nothing gets saved server-side).
      if (controller.signal.aborted) {
        updateTurn(id, { status: 'stopped' })
      } else {
        updateTurn(id, {
          errorMessage: err instanceof Error ? err.message : 'Something went wrong.',
          status: 'error',
        })
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
    }
  }, [updateTurn])

  const stop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const isStreaming = turns.some((t) => t.status === 'streaming')
  return { turns, ask, stop, isStreaming }
}
