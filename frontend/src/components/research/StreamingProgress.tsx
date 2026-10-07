import { useEffect, useState } from 'react'
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

/**
 * What a live run is doing, as a few phrases per phase that take turns so the
 * box keeps moving even while a single step takes a while: before the backend
 * has read the question, while the model picks its searches, while searches
 * are in flight, and while it works through the results and writes.
 */
const PHASE_PHRASES = {
  reviewing: ['Reviewing your inquiry…', 'Understanding what you need…', 'Framing the research question…'],
  planning: ['Planning the research…', 'Choosing where to look…', 'Drafting search queries…'],
  searching: ['Searching the web…', 'Checking scholarly literature…', 'Collecting relevant sources…', 'Filtering out weak sources…'],
  analysing: ['Analysing the sources…', 'Cross-checking the evidence…', 'Weighing source credibility…', 'Connecting the findings…', 'Writing the brief…'],
} as const

type Phase = keyof typeof PHASE_PHRASES

function phaseOf(events: StreamEvent[], searchRunning: boolean): Phase {
  if (events.length === 0) return 'reviewing'
  if (searchRunning) return 'searching'
  if (!events.some((e) => e.type === 'searching')) return 'planning'
  return 'analysing'
}

const PHRASE_MS = 2600

/** Cycles through a phase's phrases; keyed by phase, so a new phase starts at its first one. */
function StatusLine({ phase }: { phase: Phase }) {
  const [tick, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), PHRASE_MS)
    return () => clearInterval(id)
  }, [])
  const phrases = PHASE_PHRASES[phase]
  const phrase = phrases[tick % phrases.length]
  return (
    <li className="flex items-center gap-2 text-sm font-medium" aria-live="polite">
      <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand" />
      {/* Keyed by text so each new phrase remounts and replays its entrance. */}
      <span key={phrase} className="status-phrase">{phrase}</span>
    </li>
  )
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
  // A finished run folds its trail away behind a toggle; a live run always shows it.
  const [showSteps, setShowSteps] = useState(false)

  const toggle = (index: number) => {
    setOpenRows((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const stepsToggle = done && (
    <button
      type="button"
      onClick={() => setShowSteps(!showSteps)}
      aria-expanded={showSteps}
      className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-ink hover:text-brand-dark"
    >
      <span className="text-[10px] leading-none">{showSteps ? '▾' : '▸'}</span>
      {showSteps ? 'Hide research steps' : 'Show research steps'}
    </button>
  )

  if (done && !showSteps) return stepsToggle

  const rows = underItsSearch(events)
  const searchRunning = rows.some((r) => r.event.type === 'searching' && !r.answered)
  const phase = phaseOf(events, searchRunning)
  const firstSwitch = events.findIndex((e) => e.type === 'provider_failed')

  return (
    <div className="rounded-2xl border border-black/25 bg-white p-5">
      <div className="mb-3">
        {stepsToggle || <span className="text-sm font-medium text-ink">Researching</span>}
      </div>

      <ul className="flex flex-col gap-2">
        {rows.map(({ event, index: i, answered }) => {
          if (event.type === 'searching') {
            return (
              <li key={i} className="flex items-center gap-2 text-sm text-ink">
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
                <li key={i} className="pl-3.5 text-sm text-ink">
                  {label}
                </li>
              )
            }

            const isOpen = openRows.has(i)
            // The chip look is shared; only a live run makes them real links.
            const chipClass = 'rounded-md border border-black/25 bg-black/[0.03] px-2 py-1 text-xs'

            return (
              <li key={i} className="pl-3.5">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-expanded={isOpen}
                  className="flex cursor-pointer items-center gap-1 text-sm text-ink transition-colors hover:text-brand-dark"
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
                          className={`${chipClass} text-ink`}
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
                          className={`${chipClass} text-ink transition-colors hover:border-brand/40 hover:bg-brand/10 hover:text-brand-dark`}
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

          // Model names mean nothing to users, and several fallbacks in a row
          // read as alarming: one neutral line at the first switch says it all.
          if (event.type === 'provider_failed') {
            if (i !== firstSwitch) return null
            return (
              <li key={i} className="pl-3.5 text-sm text-ink">
                Switching to a backup model…
              </li>
            )
          }

          return null
        })}
        {!done && <StatusLine key={phase} phase={phase} />}
      </ul>
    </div>
  )
}
