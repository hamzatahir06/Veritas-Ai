import { useState, type ReactNode } from 'react'
import SectionHeading from './SectionHeading'

/**
 * "What you get", shown instead of told: a sample brief beside the six things that make it
 * defensible. Pointing at (or tapping) a point lights up that part of the document.
 * Every point is something the product does today — see backend/agent/prompts.py (structure,
 * citations, Limitations), agent/tools.py (ranking) and services/charts.py (the chart gate).
 */

type Part = 'summary' | 'cite' | 'chart' | 'limits' | 'sources' | 'export'

const PARTS: { id: Part; title: string; text: string }[] = [
  { id: 'summary', title: 'The answer comes first', text: 'The executive summary opens with the conclusion; seven fixed sections then back it up.' },
  { id: 'cite', title: 'Every claim is cited', text: 'IEEE-numbered citations sit on each statement, and every number opens the source it came from.' },
  { id: 'chart', title: 'Charts only from real data', text: 'A chart appears only when the brief’s own tables clearly support one. The model never draws a figure.' },
  { id: 'limits', title: 'Gaps stated, not filled', text: 'Whatever the evidence can’t settle goes in Limitations, instead of being filled in from memory.' },
  { id: 'sources', title: 'Sources ranked by authority', text: 'Government, university and peer-reviewed work leads the reference list; forums are dropped.' },
  { id: 'export', title: 'Ready to send', text: 'Download a typeset PDF or an editable Word file, reference list included.' },
]

const label = 'text-[10px] font-bold uppercase tracking-widest text-ink/70'

/** One annotated part of the sample brief: ringed and numbered while its point is active. */
function Region({ id, active, children, className = '' }: { id: Part; active: Part; children: ReactNode; className?: string }) {
  const on = active === id
  return (
    <div className={`relative rounded-lg p-2 transition-all duration-300 ${on ? 'bg-brand/10 ring-2 ring-brand' : ''} ${className}`}>
      {on && (
        <span className="absolute -top-2.5 -right-2.5 flex h-5 w-5 animate-pop-in items-center justify-center rounded-full bg-brand text-[11px] font-bold text-black shadow">
          {PARTS.findIndex((p) => p.id === id) + 1}
        </span>
      )}
      {children}
    </div>
  )
}

export default function BriefAnatomy() {
  const [active, setActive] = useState<Part>('summary')

  const cite = (k: number) => (
    <span
      className={`rounded px-1 text-xs font-semibold transition-colors duration-300 ${
        active === 'cite' ? 'bg-brand text-black ring-2 ring-brand' : 'bg-brand/15 text-brand-dark'
      }`}
    >
      [{k}]
    </span>
  )

  return (
    <section className="reveal">
      <SectionHeading eyebrow="What you get" title="A brief you can defend, line by line">
        Every run ends in the same structured, sourced document. Point at any feature to see where it lives.
      </SectionHeading>

      <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-12">
        {/* The sample brief: a sheet of paper on a dark stage. */}
        <div className="rounded-2xl bg-ink bg-[radial-gradient(ellipse_80%_60%_at_0%_0%,rgb(53_182_158/0.3),transparent_70%)] p-3 shadow-[0_24px_60px_-28px_var(--color-ink)] sm:p-6">
          <div className="mb-3 flex items-center justify-between px-1 text-[11px] font-semibold text-white/80">
            <span>brief.pdf</span>
            <span>Illustrative sample</span>
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-white p-3 text-ink shadow-2xl sm:p-5">
            <div className="px-2 pb-1">
              <div className={label}>Research brief</div>
              <div className="mt-1 font-serif text-lg font-semibold leading-snug sm:text-xl">
                Solid-State Batteries and the EV Supply Chain
              </div>
              <div className="mt-1 text-xs text-ink/70">12 sources · 7 sections</div>
            </div>

            <Region id="summary" active={active}>
              <div className={label}>1 · Executive summary</div>
              <p className="mt-1 text-sm leading-relaxed">
                Solid-state cells reach 400–500 Wh/kg in prototypes {cite(1)}, but a lithium-sulfide supply chain barely
                exists {cite(3)}, so volume production is unlikely before 2028 {cite(2)}.
              </p>
            </Region>

            <div className="grid gap-2 sm:grid-cols-2">
              <Region id="chart" active={active}>
                <div className={label}>Energy density, Wh/kg</div>
                <div className="mt-2 flex flex-col gap-1.5 text-[11px] font-medium">
                  {([['Li-ion today', 270, '54%'], ['Solid-state, lab', 450, '90%']] as const).map(([name, v, w]) => (
                    <div key={name}>
                      <div className="flex justify-between"><span>{name}</span><span className="tabular-nums">{v}</span></div>
                      <div className="mt-0.5 h-2 rounded-full bg-black/10">
                        <div className="h-full rounded-full bg-brand" style={{ width: w }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-1.5 text-[10px] text-ink/70">Drawn from Table 2 of this brief</div>
              </Region>
              <Region id="limits" active={active}>
                <div className={label}>7 · Limitations</div>
                <p className="mt-1 text-xs leading-relaxed">
                  No independent data yet on cycle life at production scale; manufacturer figures are unverified.
                </p>
              </Region>
            </div>

            <Region id="sources" active={active}>
              <div className={label}>References</div>
              <ol className="mt-1 flex flex-col gap-1 text-xs">
                {([
                  ['U.S. Department of Energy — Solid-state battery R&D', 'Official'],
                  ['IEA — Global EV Outlook', 'Official'],
                  ['Nature Energy — Sulfide electrolytes at scale', 'Peer-reviewed'],
                ] as const).map(([ref, tag], i) => (
                  <li key={ref} className="flex items-center gap-2">
                    <span className="w-5 shrink-0 font-semibold tabular-nums">[{i + 1}]</span>
                    <span className="min-w-0 flex-1 truncate">{ref}</span>
                    <span
                      className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${
                        tag === 'Official' ? 'bg-brand/15 text-brand-dark' : 'bg-indigo-50 text-indigo-800'
                      }`}
                    >
                      {tag}
                    </span>
                  </li>
                ))}
              </ol>
            </Region>

            <Region id="export" active={active} className="flex items-center justify-end gap-2">
              <span className="mr-auto text-[11px] text-ink/70">Download</span>
              <span className="rounded-md bg-red-600 px-2.5 py-1 text-[11px] font-semibold text-white">PDF</span>
              <span className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white">Word</span>
            </Region>
          </div>
        </div>

        {/* The points: hover, focus or tap one to light up its part of the brief. */}
        <ol className="flex flex-col">
          {PARTS.map(({ id, title, text }, i) => {
            const on = active === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(id)}
                  onFocus={() => setActive(id)}
                  onClick={() => setActive(id)}
                  aria-pressed={on}
                  className={`flex w-full cursor-pointer gap-4 border-l-2 py-3 pl-4 text-left transition-colors ${
                    on ? 'border-brand' : 'border-black/15 hover:border-black/40'
                  }`}
                >
                  <span className={`pt-0.5 font-mono text-sm font-semibold tabular-nums ${on ? 'text-brand-dark' : 'text-ink/70'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-ink">{title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-ink/80">{text}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}
