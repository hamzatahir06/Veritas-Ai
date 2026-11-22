import { useEffect, useState } from 'react'
import { prefersReducedMotion, useInView } from '../../hooks/useInView'
import SectionHeading from './SectionHeading'

// Content: edit copy here; the markup below is generic.

/** The baseline the chart and method note share: 20 sources × 15 min + 45 min writing. */
const MANUAL_MIN = 20 * 15 + 45
const VERITAS_MIN = 3

/** [count-up value, prefix, suffix, caption] — the stat tiles under the chart. */
const BRIEF_METRICS: [number, string, string, string][] = [
  [20, '~', '', 'sources located, ranked and cited in a typical brief'],
  [Math.round(MANUAL_MIN / VERITAS_MIN), '', '×', 'faster than the manual analyst baseline'],
  [7, '', '', 'fixed sections in every brief, from summary to limitations'],
]

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

const HOUR_TICKS = [0, 1, 2, 3, 4, 5, 6]
const CHART_MAX_MIN = 6 * 60

/**
 * One bar of the time chart, on a 0–6h axis. The Veritas bar is a few pixels
 * wide by nature, so it gets a glow + pulsing tip to read as "there, and tiny".
 */
function TimeBar({ label, valueLabel, minutes, slow = false, play }: {
  label: string
  valueLabel: string
  minutes: number
  slow?: boolean
  play: boolean
}) {
  const pct = (minutes / CHART_MAX_MIN) * 100
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className={`font-semibold ${slow ? 'text-rose-300' : 'text-brand'}`}>{label}</span>
        <span className="font-bold tabular-nums text-white">{valueLabel}</span>
      </div>
      <div className="relative h-9 rounded-lg bg-white/[0.06] ring-1 ring-white/10 ring-inset">
        <div
          className={`absolute inset-y-1 left-1 rounded-md transition-[width] duration-[1300ms] ease-out motion-reduce:transition-none ${
            slow
              ? 'bg-linear-to-r from-rose-600 to-red-500 shadow-[0_0_24px_-4px_rgb(244_63_94/0.7)]'
              : 'min-w-3 bg-linear-to-r from-brand-dark to-brand shadow-[0_0_20px_2px_var(--color-brand)]'
          }`}
          style={{ width: play ? `calc(${pct}% - 0.5rem)` : '0%' }}
        >
          {/* Stripes on their own layer: they're a background-image too, and would replace the gradient. */}
          {slow
            ? <span className="bar-stripes absolute inset-0 rounded-md" />
            : <span className="absolute top-1/2 -right-1 h-2.5 w-2.5 -translate-y-1/2 animate-ping rounded-full bg-brand" />}
        </div>
      </div>
    </div>
  )
}

/** "Time saved": the manual-vs-Veritas hours chart, stat tiles and method note. */
export default function TimeSaved() {
  const [analyticsRef, analyticsInView] = useInView<HTMLElement>()

  return (
    <section className="reveal">
      <SectionHeading eyebrow="Time saved" title="Hours of manual research, done in minutes">
        The same 20-source brief, done by hand and done by Veritas.
      </SectionHeading>

      {/* Time-to-brief analysis */}
      <figure
        ref={analyticsRef}
        className="relative overflow-hidden rounded-3xl border-2 border-black bg-ink p-5 text-white shadow-[0_30px_80px_-30px_var(--color-ink)] sm:p-8"
      >
        <div aria-hidden="true" className="tech-grid pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="cta-glow pointer-events-none absolute inset-0 opacity-70" />

        <div className="relative">
          <figcaption className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-white">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              Time-to-brief analysis
            </span>
            <span className="text-xs font-semibold text-white/75">One 20-source brief · hours</span>
          </figcaption>

          <div className="mt-7 grid gap-8 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:items-center md:gap-10">
            {/* Headline figure */}
            <div>
              <div className="bg-linear-to-br from-white to-brand bg-clip-text text-6xl font-extrabold leading-none tracking-tight tabular-nums text-transparent sm:text-7xl">
                <CountUp value={(MANUAL_MIN - VERITAS_MIN) / 60} decimals={1} play={analyticsInView} />
                <span className="ml-1 text-3xl sm:text-4xl">hrs</span>
              </div>
              <p className="mt-3 text-sm font-medium text-white/80">
                of analyst time saved on a typical 20-source research brief
              </p>
            </div>

            {/* Chart: two bars over an hour axis with faint gridlines */}
            <div className="relative">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-1 top-0 bottom-6 flex justify-between">
                {HOUR_TICKS.map((h) => <span key={h} className="w-px bg-white/10" />)}
              </div>
              <div className="relative flex flex-col gap-5">
                <TimeBar label="Manual research" valueLabel="≈ 5h 45m" minutes={MANUAL_MIN} slow play={analyticsInView} />
                <TimeBar label="Veritas AI" valueLabel="≈ 3 min" minutes={VERITAS_MIN} play={analyticsInView} />
              </div>
              <div aria-hidden="true" className="mt-2 flex justify-between px-1 text-[11px] font-semibold tabular-nums text-white/70">
                {HOUR_TICKS.map((h) => <span key={h} className="w-0 text-center">{h}h</span>)}
              </div>
            </div>
          </div>

          {/* Glass stat tiles */}
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {BRIEF_METRICS.map(([value, prefix, suffix, caption]) => (
              <div
                key={caption}
                className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/[0.05] p-4 backdrop-blur-sm"
              >
                <span aria-hidden="true" className="absolute inset-x-4 top-0 h-px bg-linear-to-r from-transparent via-brand to-transparent" />
                <div className="text-3xl font-extrabold tracking-tight tabular-nums text-white">
                  {prefix}<CountUp value={value} play={analyticsInView} />{suffix}
                </div>
                <div className="mt-1 text-xs font-medium leading-snug text-white/80">{caption}</div>
              </div>
            ))}
          </div>

          {/* Methodology — keeps the numbers honest, folded away until asked for. */}
          <details className="group mt-5 text-xs leading-relaxed text-white/80">
            <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 font-semibold text-white transition-colors hover:text-brand [&::-webkit-details-marker]:hidden">
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">▸</span>
              How we calculated this
            </summary>
            <p className="mt-2 max-w-3xl">
              A typical Veritas brief cites ~20 primary sources. The manual baseline assumes ≈ 15 min of
              analyst time per source to locate it, read the relevant passage and verify the citation,
              plus ≈ 45 min to synthesise a structured, referenced brief — ≈ 5¾ hours. Title-and-abstract
              screening alone averages ~45 seconds per record; full-text appraisal typically runs 10–20
              minutes per paper (published systematic-review workload studies). Veritas completes the same
              scope in a single run averaging ≈ 3 minutes.
            </p>
          </details>
        </div>
      </figure>
    </section>
  )
}
