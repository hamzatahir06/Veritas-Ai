import { Link } from 'react-router-dom'
import Footer from '../components/shell/Footer'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { usePageContext } from '../hooks/usePageContext'

/**
 * [stat, explanation] — rows for the two comparison cards. Stat leads; keep it short.
 * Figures are from published research-workflow studies:
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

/** Only what the product does today (see BriefAnatomy / Faq for the same claims). */
const VERITAS_SOLUTIONS: [string, string][] = [
  ['Every claim cited', 'IEEE-style at the claim — each [n] opens the exact source it came from.'],
  ['Official sources first', 'government, university and intergovernmental sites outrank the rest; forums are excluded.'],
  ['Peer-reviewed built in', 'scholarly literature from OpenAlex is searched alongside the live web, in the same run.'],
  ['Minutes, not hours', 'to a structured brief: executive summary, key findings, limitations and a full reference list.'],
  ['0 data stored', 'for guests — run a full brief with no account, and your research question is never saved.'],
]

/** The "old way" (light, red) and "with Veritas" (dark, glowing) cards — same rows, two palettes. */
function ComparisonCard({ pain, heading, items }: { pain: boolean; heading: string; items: [string, string][] }) {
  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-3xl border-2 p-5 sm:p-7 ${
        pain ? 'border-black/15 bg-white' : 'border-brand bg-ink text-white shadow-[0_24px_60px_-28px_var(--color-brand)]'
      }`}
    >
      {!pain && <div aria-hidden="true" className="cta-glow pointer-events-none absolute inset-0 opacity-60" />}
      <div className="relative mb-5 flex items-center justify-between gap-3">
        <h3 className={`text-lg font-extrabold tracking-tight ${pain ? 'text-ink' : 'text-white'}`}>{heading}</h3>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-widest ${
            pain ? 'bg-red-100 text-red-700' : 'bg-brand text-black'
          }`}
        >
          {pain ? 'Manual' : 'Veritas AI'}
        </span>
      </div>
      <ul className="relative flex flex-col gap-4">
        {items.map(([stat, detail]) => (
          <li key={stat} className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                pain ? 'bg-red-100 text-red-600' : 'bg-brand/20 text-brand ring-1 ring-brand/50'
              }`}
            >
              {pain ? '✕' : '✓'}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className={`text-lg font-extrabold tracking-tight tabular-nums leading-tight ${pain ? 'text-red-600' : 'text-brand'}`}>
                {stat}
              </span>
              <span className={`text-sm leading-snug ${pain ? 'text-ink/80' : 'text-white/80'}`}>{detail}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** /why-us: manual research vs. a Veritas run, side by side. Linked from the TopBar and footer. */
export default function WhyUs() {
  useDocumentTitle('Why us')
  const { isSignedIn } = usePageContext()

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-[#fafafa]">
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="font-serif text-3xl font-bold text-balance text-ink sm:text-4xl">Why switch to Veritas AI</h1>
          <p className="mt-3 text-base text-balance text-ink/75 sm:text-lg">
            Where manual research loses hours, and what Veritas does instead.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:mt-12 md:grid-cols-2">
          <ComparisonCard pain heading="The old way" items={RESEARCH_PAINS} />
          <ComparisonCard pain={false} heading="With Veritas AI" items={VERITAS_SOLUTIONS} />
        </div>

        <div className="mt-10 flex justify-center">
          <Link
            to="/"
            className="rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-dark"
          >
            Start a research brief
          </Link>
        </div>
      </div>
      {!isSignedIn && <Footer />}
    </div>
  )
}
