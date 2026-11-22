import { useState } from 'react'
import SectionHeading from './SectionHeading'

/** Example questions per field. Clicking one runs it for real — the explorer is a way in, not decoration. */
const FIELDS: { name: string; who: string; questions: string[] }[] = [
  {
    name: 'Healthcare',
    who: 'Clinicians, researchers and health-policy teams',
    questions: [
      'What does current evidence say about GLP-1 drugs and cardiovascular outcomes?',
      'Latest WHO guidance on antimicrobial resistance surveillance',
      'Peer-reviewed findings on long COVID prevalence in adults',
    ],
  },
  {
    name: 'Law & Compliance',
    who: 'Counsel, compliance officers and policy analysts',
    questions: [
      'How does the EU AI Act classify high-risk AI systems?',
      'Summary of recent FTC guidance on algorithmic pricing',
      'GDPR fines for data transfers to the US since 2023',
    ],
  },
  {
    name: 'Finance',
    who: 'Analysts, investors and finance teams',
    questions: [
      'Compare 10-K risk disclosures for the top AI chip vendors',
      'How are central banks approaching digital currencies in 2026?',
      'IMF outlook on emerging-market debt sustainability',
    ],
  },
  {
    name: 'Policy',
    who: 'Government, think tanks and NGOs',
    questions: [
      'Evidence on universal basic income pilot outcomes',
      'How effective are carbon border adjustment mechanisms?',
      'OECD data on housing affordability across member countries',
    ],
  },
  {
    name: 'Engineering',
    who: 'Engineers, R&D and technical leads',
    questions: [
      'State of solid-state battery manufacturing scale-up',
      'Peer-reviewed progress on fusion plasma containment',
      'NIST post-quantum cryptography standards and migration guidance',
    ],
  },
  {
    name: 'Academia',
    who: 'Students, faculty and literature reviewers',
    questions: [
      'Literature review: retrieval-augmented generation and hallucination',
      'What do meta-analyses say about spaced repetition and learning?',
      'Recent findings on microplastics in human tissue',
    ],
  },
]

export default function UseCases({ onSelect }: { onSelect: (topic: string) => void }) {
  const [active, setActive] = useState(0)
  const field = FIELDS[active]

  return (
    <section className="reveal">
      <SectionHeading eyebrow="Use cases" title="Built around the questions your field actually asks">
        Pick a field, then tap a question — it runs a real brief straight away.
      </SectionHeading>

      {/* Tabs swipe on phones, wrap centred from sm. */}
      <div
        role="tablist"
        aria-label="Fields"
        className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:justify-center sm:px-0"
      >
        {FIELDS.map((f, i) => (
          <button
            key={f.name}
            type="button"
            role="tab"
            id={`usecase-tab-${i}`}
            aria-selected={i === active}
            aria-controls="usecase-panel"
            onClick={() => setActive(i)}
            className={`shrink-0 cursor-pointer rounded-full border-2 px-4 py-2 text-sm font-bold transition-colors ${
              i === active ? 'border-black bg-black text-white' : 'border-black/20 bg-white text-ink hover:border-black'
            }`}
          >
            {f.name}
          </button>
        ))}
      </div>

      <div
        id="usecase-panel"
        role="tabpanel"
        aria-labelledby={`usecase-tab-${active}`}
        className="mt-5 rounded-2xl border-2 border-black bg-white p-4 shadow-sm sm:p-6"
      >
        <p className="mb-4 text-sm font-semibold text-ink/75">For {field.who.toLowerCase()}</p>
        {/* Keyed by field so the cards replay their entrance on every tab change. */}
        <div key={active} className="grid gap-3 md:grid-cols-3">
          {field.questions.map((q, i) => (
            <button
              key={q}
              type="button"
              onClick={() => onSelect(q)}
              style={{ animationDelay: `${i * 70}ms` }}
              className="group flex animate-fade-up cursor-pointer flex-col justify-between gap-4 rounded-xl border border-black/20 bg-[#fafafa] p-4 text-left transition-all hover:-translate-y-0.5 hover:border-brand hover:bg-white hover:shadow-md"
            >
              <span className="text-sm font-semibold leading-snug text-ink">{q}</span>
              <span className="flex items-center gap-1.5 text-xs font-bold text-brand-dark">
                Run this brief
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
