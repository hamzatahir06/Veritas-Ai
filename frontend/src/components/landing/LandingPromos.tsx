import { useEffect, useRef, useState } from 'react'

/* ------------------------------------------------------------------ *
 * Content — edit copy here; the markup below is generic and reused.  *
 * ------------------------------------------------------------------ */

const OFFICIAL_SOURCES = [
  'Government (.gov) Repositories',
  'SEC EDGAR Filings',
  'PubMed & WHO Health Data',
  'IEEE Xplore Tech Papers',
  'Nature & Science Journals',
  'JSTOR Academic Archives',
  'World Bank & IMF Datasets',
  'NASA & CERN Research',
]

/** [figure, caption] — the supporting metrics under the headline number. */
const BRIEF_METRICS: [string, string][] = [
  ['~20', 'sources located, read & cross-checked per brief'],
  ['115×', 'faster than a manual analyst pass'],
  ['8+', 'official repositories queried in parallel'],
]

/**
 * [stat, explanation] — rows for the two comparison cards. Stat leads; keep it short.
 * Figures are sourced from published research-workflow studies (see PR / audit notes):
 * ~7 hrs/wk searching (Science/AAAS); <5% search-result relevance & ~73% paywalled,
 * ~$30/paper (Nature); ~20% of citations contain errors (arXiv 2511.04683); tens of
 * thousands of 2025 papers carry fabricated AI citations (Nature / Lancet).
 */
const RESEARCH_PAINS: [string, string][] = [
  ['~7 hrs / week', 'gone just locating sources — before a single paper is actually read.'],
  ['< 5% relevant', 'of the 5,000+ hits a typical search returns; the rest is sifted by hand.'],
  ['~73% paywalled', 'of scholarly papers, at an average of ~$30 each to even open.'],
  ['1 in 5 citations', 'in published work still contains an error you have to catch yourself.'],
  ['10,000s of papers', 'published in 2025 already carry fabricated AI citations blended in with the real ones.'],
]

const VERITAS_SOLUTIONS: [string, string][] = [
  ['100% of claims', 'link to a verbatim source passage — click any sentence for the exact quote, page and URL.'],
  ['8+ official repositories', 'on a fixed, published list (.gov, SEC EDGAR, PubMed, OpenAlex…) — coverage you can name, not a black box.'],
  ['2+ archives', 'cross-checked for every key figure; conflicts are flagged, not averaged away.'],
  ['~3 minutes', 'to a structured brief: executive summary, key findings, limitations and a full bibliography.'],
  ['0 data stored', 'for guests — run a full brief with no account, and your research question is never saved.'],
]

/* ------------------------------------------------------------------ *
 * Reusable primitives                                               *
 * ------------------------------------------------------------------ */

/** Fires once when the element first scrolls ~35% into view. */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || inView) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold: 0.35 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [inView])

  return [ref, inView] as const
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Counts from 0 up to `value` over ~1.1s once `play` turns true. */
function CountUp({ value, decimals = 0, play }: { value: number; decimals?: number; play: boolean }) {
  const [n, setN] = useState(0)

  useEffect(() => {
    if (!play) return

    let raf = 0
    // Jump straight to the value, but on the next frame rather than inline —
    // a synchronous setState here would cascade an extra render.
    if (prefersReducedMotion()) {
      raf = requestAnimationFrame(() => setN(value))
      return () => cancelAnimationFrame(raf)
    }

    const start = performance.now()
    const duration = 1100
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setN(value * (1 - Math.pow(1 - p, 3))) // easeOutCubic
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [play, value])

  return <>{n.toFixed(decimals)}</>
}

/** One row of the manual-vs-Veritas time comparison. `red` marks the wasteful option. */
function CompareBar({
  label,
  valueLabel,
  pct,
  red = false,
  play,
}: {
  label: string
  valueLabel: string
  pct: number
  red?: boolean
  play: boolean
}) {
  const ink = red ? 'text-red-600' : 'text-ink'
  return (
    <div className="flex items-center gap-3">
      <span className={`w-24 shrink-0 text-xs font-semibold sm:w-28 sm:text-sm ${red ? 'text-red-600' : 'text-ink/70'}`}>
        {label}
      </span>
      <span className="relative h-6 flex-1 overflow-hidden rounded-md bg-black/[0.04] sm:h-7">
        <span
          className={`absolute inset-y-0 left-0 min-w-[4px] rounded-md transition-[width] duration-[1100ms] ease-out motion-reduce:transition-none ${
            red ? 'bg-red-500' : 'bg-brand'
          }`}
          style={{ width: play ? `${pct}%` : '0%' }}
        />
      </span>
      <span className={`w-16 shrink-0 text-right text-xs font-bold tabular-nums sm:text-sm ${ink}`}>
        {valueLabel}
      </span>
    </div>
  )
}

/** The red "pain" card and the teal "solution" card — same shape, different palette. */
function ComparisonCard({
  pain,
  heading,
  items,
}: {
  pain: boolean
  heading: string
  items: [string, string][]
}) {
  return (
    <div className={`flex flex-col rounded-2xl border-2 p-6 shadow-sm ${pain ? 'border-red-500/80 bg-red-50/40' : 'border-brand bg-brand/5'}`}>
      <div className={`mb-4 flex items-center gap-2 font-extrabold ${pain ? 'text-red-700' : 'text-brand-dark'}`}>
        <h4 className="text-base sm:text-lg">{heading}</h4>
        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs text-white ${pain ? 'bg-red-600' : 'bg-brand'}`}>
          {pain ? '✕' : '✓'}
        </span>
      </div>
      <ul className={`flex flex-col gap-3.5 text-xs sm:text-sm font-medium ${pain ? 'text-red-950/80' : 'text-ink/80'}`}>
        {items.map(([stat, detail]) => (
          <li key={stat} className="flex items-start gap-2.5">
            <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] text-white ${pain ? 'bg-red-600' : 'bg-brand'}`}>
              {pain ? '✕' : '✓'}
            </span>
            <span className="flex flex-col gap-0.5">
              {/* number leads — the stat is the hook, the line below is context */}
              <span className={`font-serif text-lg font-bold tabular-nums leading-none sm:text-xl ${pain ? 'text-red-600' : 'text-brand-dark'}`}>
                {stat}
              </span>
              <span>{detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function LandingPromos() {
  const [analyticsRef, analyticsInView] = useInView<HTMLElement>()

  return (
    <div className="mt-8 flex w-full flex-col gap-12 pb-12">

      {/* ---------------- 1. CREDIBLE SOURCES ---------------- */}
      <div id="sources" className="flex scroll-mt-6 flex-col items-center gap-4 text-center">
        <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-widest text-ink/70">
          Get Authentic Data Direct From Official & Credible Sources
        </h3>

        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-4 text-xs sm:text-sm font-bold text-ink">
          {OFFICIAL_SOURCES.map((name) => (
            <span
              key={name}
              className="flex items-center justify-center gap-2 rounded-xl border border-black/15 bg-white py-2.5 px-3 shadow-2xs"
            >
              <span className="h-2 w-2 rounded-full bg-brand" />
              {name}
            </span>
          ))}
        </div>
      </div>

      {/* ---------------- 2. WHY YOU MUST SWITCH TO VERITAS AI ---------------- */}
      <div className="flex flex-col gap-4">
        <h3 className="text-center text-lg font-extrabold tracking-tight text-ink sm:text-xl">
          Why You Must Switch to Veritas AI
        </h3>

        {/* ---- 2a. TIME-TO-BRIEF ANALYSIS (research-style efficiency panel) ---- */}
        <figure
          ref={analyticsRef}
          className="mb-2 rounded-2xl border border-black/10 bg-white p-6 shadow-sm sm:p-8"
        >
          <figcaption className="mb-5 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-widest text-ink/50">
            <span className="h-1.5 w-1.5 rounded-full bg-brand" />
            Time-to-brief analysis
          </figcaption>

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-10">
            {/* Headline figure */}
            <div className="shrink-0 sm:w-52">
              <div className="font-serif text-4xl font-bold leading-none tabular-nums text-brand sm:text-5xl">
                <CountUp value={5.7} decimals={1} play={analyticsInView} />
                <span className="ml-1 text-2xl sm:text-3xl">hrs</span>
              </div>
              <p className="mt-2 text-sm font-medium text-ink/70">
                of analyst time saved on a typical 20-source research brief
              </p>
            </div>

            {/* Manual vs Veritas comparison */}
            <div className="flex flex-1 flex-col gap-3">
              <CompareBar label="Manual research" valueLabel="≈ 5h 45m" pct={100} red play={analyticsInView} />
              <CompareBar label="Veritas AI" valueLabel="≈ 3 min" pct={1.5} play={analyticsInView} />
            </div>
          </div>

          {/* Supporting metrics */}
          <div className="mt-7 grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-black/10 bg-black/10 text-center">
            {BRIEF_METRICS.map(([figure, caption]) => (
              <div key={figure} className="bg-white px-2 py-4 sm:px-3">
                <div className="font-serif text-xl font-bold tabular-nums text-ink sm:text-2xl">{figure}</div>
                <div className="mt-1 text-[11px] font-medium leading-tight text-ink/55">{caption}</div>
              </div>
            ))}
          </div>

          {/* Methodology — keeps the numbers honest */}
          <figcaption className="mt-5 text-[11px] leading-relaxed text-ink/45">
            <strong className="font-semibold text-ink/60">Method.</strong> A typical Veritas brief
            cites ~20 primary sources. The manual baseline assumes ≈ 15 min of analyst time per
            source to locate it, read the relevant passage and verify the citation, plus ≈ 45 min to
            synthesise a structured, referenced brief — ≈ 5.7 hours. Title-and-abstract screening
            alone averages ~45 seconds per record; full-text appraisal typically runs 10–20 minutes
            per paper (published systematic-review workload studies). Veritas completes the same
            scope in a single run averaging ≈ 3 minutes.
          </figcaption>
        </figure>

        <div className="grid gap-6 sm:grid-cols-2">
          <ComparisonCard pain heading="Real Research Hardships & Pain" items={RESEARCH_PAINS} />
          <ComparisonCard pain={false} heading="The Veritas AI Solution" items={VERITAS_SOLUTIONS} />
        </div>
      </div>

    </div>
  )
}
