import { useEffect, useState, type ReactNode } from 'react'
import { prefersReducedMotion, useInView } from '../../hooks/useInView'
import SectionHeading from './SectionHeading'

/**
 * "How it works" as a playable walkthrough: five steps on the left, a mock app
 * window on the right showing that step of an illustrative run. It autoplays
 * once scrolled into view; picking a step takes over (autoplay stops) and
 * Replay hands it back. Every step describes what the agent really does
 * (see backend/agent/tools.py + prompts.py); only the sample data is made up.
 */

const STEP_MS = 3600
const TOPIC = 'How are solid-state batteries changing EV supply chains?'

// Panel palette (dark window): zinc-100 headings, zinc-300 body, zinc-400 muted, brand accents.
const chip = 'rounded-md border border-white/15 bg-white/5 px-2 py-1 text-xs font-medium text-zinc-200'
const row = 'flex animate-fade-up items-start gap-2 text-sm text-zinc-300'
const dot = <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)]" />

/** [query, where the plan aims it, domains it found] — shared by the plan and search steps. */
const SEARCHES: [string, string, string[]][] = [
  ['solid-state battery energy density 2026', 'energy.gov', ['energy.gov', 'nrel.gov', 'iea.org']],
  ['lithium sulfide electrolyte supply chain', 'iea.org', ['nature.com', 'sciencedirect.com']],
  ['solid-state cell manufacturing scale-up', 'peer-reviewed', ['arxiv.org', 'acs.org', 'mdpi.com']],
]

const TAGS = {
  official: ['Official', 'border-brand/40 bg-brand/15 text-brand'],
  paper: ['Peer-reviewed', 'border-indigo-400/40 bg-indigo-500/15 text-indigo-300'],
  web: ['Web', 'border-white/15 bg-white/5 text-zinc-300'],
} as const

function Tag({ tone }: { tone: keyof typeof TAGS }) {
  const [label, colors] = TAGS[tone]
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${colors}`}>{label}</span>
}

const STEPS: { title: string; blurb: string; panel: ReactNode }[] = [
  {
    title: 'Ask in plain language',
    blurb: 'No keywords, filters or boolean operators — just the question you would ask a colleague.',
    panel: (
      <>
        <div className="flex justify-end">
          <div className="max-w-[85%] animate-fade-up rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-sm text-white">{TOPIC}</div>
        </div>
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand shadow-[0_0_8px_var(--color-brand)]" />
          <span className="status-phrase">Reviewing your inquiry…</span>
          <span className="demo-caret" aria-hidden="true" />
        </div>
        {/* What the classifier gate decides before any search runs (backend/agent/classifier.py). */}
        <div className="mt-auto flex animate-fade-up flex-col gap-2 rounded-xl border border-white/10 bg-white/4 p-3 text-sm text-zinc-300" style={{ animationDelay: '500ms' }}>
          <div className="flex items-center gap-2"><span className="font-bold text-brand">✓</span> Research question detected — not small talk</div>
          <div className="flex items-center gap-2"><span className="font-bold text-brand">✓</span> Scope: EV supply chains, current developments</div>
        </div>
      </>
    ),
  },
  {
    title: 'Plan the searches',
    blurb: 'The agent breaks the question into targeted queries and picks official sites worth searching inside.',
    panel: (
      <>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Research plan</div>
        {SEARCHES.map(([q, where], i) => (
          <div key={q} className={row} style={{ animationDelay: `${i * 220}ms` }}>
            {dot}
            <span className="min-w-0 flex-1">{q}</span>
            <span className={chip}>{where}</span>
          </div>
        ))}
      </>
    ),
  },
  {
    title: 'Search the web + literature',
    blurb: 'Live web results and peer-reviewed papers (via OpenAlex), several queries running in parallel.',
    panel: (
      <>
        {SEARCHES.map(([q, , domains], i) => (
          <div key={q} className="flex animate-fade-up flex-col gap-1.5" style={{ animationDelay: `${i * 260}ms` }}>
            <div className={row}>{dot}<span className="min-w-0">Searching: {q}</span></div>
            <div className="flex flex-wrap gap-1.5 pl-3.5">
              <span className="text-xs font-semibold text-zinc-400">{domains.length} sources found:</span>
              {domains.map((d) => <span key={d} className={chip}>{d}</span>)}
            </div>
          </div>
        ))}
      </>
    ),
  },
  {
    title: 'Rank by authority',
    blurb: 'Government, university and intergovernmental sources rise to the top; low-relevance hits and forums are dropped.',
    panel: (
      <>
        <div className="text-xs font-bold uppercase tracking-wider text-zinc-400">Source ranking</div>
        {([
          ['energy.gov', 'official'],
          ['iea.org', 'official'],
          ['nature.com', 'paper'],
          ['sciencedirect.com', 'paper'],
          ['electrek.co', 'web'],
        ] as const).map(([d, tone], i) => (
          <div key={d} className="flex animate-fade-up items-center gap-3 text-sm text-zinc-200" style={{ animationDelay: `${i * 140}ms` }}>
            <span className="w-4 text-right font-bold tabular-nums text-zinc-400">{i + 1}</span>
            <span className="min-w-0 flex-1 truncate font-medium">{d}</span>
            <Tag tone={tone} />
          </div>
        ))}
        {['reddit.com — forum, excluded', 'seo-blog.net — below relevance floor'].map((t, i) => (
          <div key={t} className="flex animate-fade-up items-center gap-3 text-sm text-red-400" style={{ animationDelay: `${(i + 5) * 140}ms` }}>
            <span className="w-4 text-right font-bold">✕</span>
            <span className="line-through decoration-red-400/70">{t}</span>
          </div>
        ))}
      </>
    ),
  },
  {
    title: 'Get a cited brief',
    blurb: 'Seven fixed sections with an IEEE citation on every claim — ready to download as PDF or Word.',
    panel: (
      <>
        <div className="animate-fade-up">
          <div className="text-base font-bold text-zinc-50">Solid-State Batteries and the EV Supply Chain</div>
          <div className="mt-3 text-xs font-bold uppercase tracking-wider text-zinc-400">Executive Summary</div>
          <p className="mt-1 text-sm leading-relaxed text-zinc-300">
            Solid-state cells promise higher energy density <span className="font-semibold text-brand">[1]</span>, but a lithium
            sulfide supply chain barely exists yet <span className="font-semibold text-brand">[3]</span>, so volume production is
            unlikely before 2028 <span className="font-semibold text-brand">[2]</span>.
          </p>
        </div>
        <div className="flex animate-fade-up flex-wrap gap-1.5" style={{ animationDelay: '200ms' }}>
          {['Key Findings', 'Background & Scope', 'Methodology & Sources', 'Findings', 'Implications', 'Limitations'].map((s) => (
            <span key={s} className={chip}>{s}</span>
          ))}
        </div>
        <div className="mt-auto flex animate-fade-up gap-2" style={{ animationDelay: '400ms' }}>
          <span className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white">PDF</span>
          <span className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white">Word</span>
        </div>
      </>
    ),
  },
]

export default function LiveDemo() {
  const [sectionRef, inView] = useInView<HTMLElement>()
  const [step, setStep] = useState(0)
  // The visitor took over by picking a step; Replay gives control back.
  const [manual, setManual] = useState(false)
  const autoplay = inView && !manual && !prefersReducedMotion()

  useEffect(() => {
    if (!autoplay) return
    const id = setTimeout(() => setStep((s) => (s + 1) % STEPS.length), STEP_MS)
    return () => clearTimeout(id)
  }, [autoplay, step])

  const pick = (i: number) => {
    setManual(true)
    setStep(i)
  }

  return (
    <section ref={sectionRef} className="reveal">
      <SectionHeading eyebrow="How it works" title="From question to cited brief in five steps">
        Watch a sample run — or click any step to see what the agent does at that point.
      </SectionHeading>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <ol className="flex flex-col gap-2">
          {STEPS.map((s, i) => {
            const active = i === step
            return (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => pick(i)}
                  aria-current={active ? 'step' : undefined}
                  className={`relative flex w-full cursor-pointer gap-3 overflow-hidden rounded-xl border-2 p-3 text-left transition-colors sm:p-4 ${
                    active ? 'border-brand bg-white shadow-md' : 'border-black/15 bg-white/70 hover:border-black/40'
                  }`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                      active ? 'bg-brand text-white' : 'bg-black/10 text-ink'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{s.title}</span>
                    {active && <span className="mt-1 block animate-fade-up text-sm text-ink/80">{s.blurb}</span>}
                  </span>
                  {/* Time left on this step while autoplaying; keyed so it restarts each step. */}
                  {active && autoplay && (
                    <span
                      key={step}
                      className="demo-progress absolute inset-x-0 bottom-0 h-1 origin-left bg-brand"
                      style={{ animationDuration: `${STEP_MS}ms` }}
                    />
                  )}
                </button>
              </li>
            )
          })}
        </ol>

        {/* Mock app window — first on phones, so the run is visible before the step list. */}
        <div className="demo-window order-first overflow-hidden rounded-2xl border border-white/10 lg:order-none">
          <div className="flex items-center gap-2 border-b border-white/10 bg-white/4 px-4 py-2.5">
            <span className="flex gap-1.5" aria-hidden="true">
              <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
              <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
              <span className="h-3 w-3 rounded-full bg-[#28c840]" />
            </span>
            <span className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-zinc-400">
              Veritas AI · illustrative sample run
            </span>
            <button
              type="button"
              onClick={() => { setManual(false); setStep(0) }}
              className="shrink-0 cursor-pointer rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-xs font-semibold text-zinc-200 transition-colors hover:border-brand/60 hover:bg-white/10 hover:text-white"
            >
              ↻ Replay
            </button>
          </div>
          {/* Keyed by step so each panel replays its entrance. Fixed height: no jump between steps. */}
          <div key={step} className="flex h-80 flex-col gap-3 overflow-hidden p-4 sm:p-5">
            {STEPS[step].panel}
          </div>
        </div>
      </div>
    </section>
  )
}
