import { useState } from 'react'
import type { StreamEvent } from '../../lib/api'

/** Host without "www.", e.g. "https://www.nature.com/x" -> "nature.com". */
function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

type Row = { event: StreamEvent; index: number; answered?: boolean }

/**
 * The trail in display order: each "N sources found" directly under the search
 * it answers. Searches in one turn run in parallel and finish in any order, so
 * a result is matched to the latest still-unanswered search with its query.
 * `index` is the event's position in the stream — a stable key for the row.
 */
function underItsSearch(events: StreamEvent[]): Row[] {
  const rows: Row[] = []
  events.forEach((event, index) => {
    if (event.type !== 'found') {
      rows.push({ event, index })
      return
    }
    let at = rows.length - 1
    while (at >= 0 && !(rows[at].event.type === 'searching' && !rows[at].answered
      && (rows[at].event as { query: string }).query === event.query)) at--
    if (at < 0) {
      rows.push({ event, index })
      return
    }
    rows[at].answered = true
    rows.splice(at + 1, 0, { event, index })
  })
  return rows
}

type StreamingProgressProps = {
  events: StreamEvent[]
  /** The run has finished: the trail stays expandable, but sources are text. */
  done?: boolean
}

export default function StreamingProgress({ events, done = false }: StreamingProgressProps) {
  // Which "N sources found" rows are open, keyed by index in `events`. Rows
  // start closed so the trail stays one line per search until asked otherwise.
  const [openRows, setOpenRows] = useState<Set<number>>(new Set())

  const toggle = (index: number) => {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-5">
      <div className="mb-3 text-sm font-medium text-ink/60">{done ? 'Research steps' : 'Researching'}</div>

      <ul className="flex flex-col gap-2">
        {underItsSearch(events).map(({ event, index: i, answered }) => {
          if (event.type === 'searching') {
            return (
              <li key={i} className="flex items-center gap-2 text-sm text-ink/80">
                {/* Pulses only while this search is still running. */}
                <span
                  className={`h-1.5 w-1.5 rounded-full bg-brand ${done || answered ? '' : 'animate-pulse'}`}
                />
                Searching: {event.query}
              </li>
            )
          }

          if (event.type === 'found') {
            const sources = event.sources ?? []
            const label = `${event.count} source${event.count === 1 ? '' : 's'} found`

            // Nothing to reveal — keep the original plain line.
            if (sources.length === 0) {
              return (
                <li key={i} className="pl-3.5 text-sm text-ink/50">
                  {label}
                </li>
              )
            }

            const isOpen = openRows.has(i)
            // The chip look is shared; only a live run makes them real links.
            const chipClass = 'rounded-md border border-black/10 bg-black/[0.03] px-2 py-1 text-xs'

            return (
              <li key={i} className="pl-3.5">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  className="flex cursor-pointer items-center gap-1 text-sm text-ink/50 transition-colors hover:text-ink/80"
                >
                  <span className="text-[10px] leading-none">{isOpen ? '▾' : '▸'}</span>
                  <span className="underline decoration-dotted underline-offset-2">{label}</span>
                </button>

                {isOpen && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {sources.map((source, j) =>
                      // Chips show the domain only, so the full headline lives
                      // in the tooltip. Once the run is done they are a record,
                      // not navigation: same pill, inert text.
                      done ? (
                        <span
                          key={j}
                          title={source.title || source.url}
                          className={`${chipClass} text-ink/50`}
                        >
                          {domainOf(source.url)}
                        </span>
                      ) : (
                        <a
                          key={j}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          title={source.title || source.url}
                          className={`${chipClass} text-ink/70 transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand-dark`}
                        >
                          {domainOf(source.url)}
                        </a>
                      ),
                    )}
                  </div>
                )}
              </li>
            )
          }

          if (event.type === 'provider_failed') {
            return (
              <li key={i} className="pl-3.5 text-sm text-amber-600">
                {event.provider} unavailable, switching provider…
              </li>
            )
          }

          return null
        })}
      </ul>
    </div>
  )
}
