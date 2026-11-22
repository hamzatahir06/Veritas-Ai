import SectionHeading from './SectionHeading'

type Tier = 'Official' | 'Intergovernmental' | 'Academic' | 'Peer-reviewed' | 'Scholarly index'

/**
 * Each tile is a tier the search actually ranks by (backend/agent/tools.py:
 * .gov/.edu/.int TLDs, INTERGOVERNMENTAL, PEER_REVIEWED) or a source it
 * queries (OpenAlex). Don't add a name the backend doesn't reach.
 */
const OFFICIAL_SOURCES: [string, Tier][] = [
  ['Government (.gov) repositories', 'Official'],
  ['SEC EDGAR filings', 'Official'],
  ['PubMed, NIH & CDC', 'Official'],
  ['University (.edu) research', 'Academic'],
  ['WHO, UN & IPCC', 'Intergovernmental'],
  ['World Bank, IMF & OECD', 'Intergovernmental'],
  ['Nature, Lancet & IEEE journals', 'Peer-reviewed'],
  ['OpenAlex scholarly index', 'Scholarly index'],
]

const TIER_TONES: Record<Tier, string> = {
  Official: 'border-brand/50 bg-brand/15 text-brand-dark',
  Intergovernmental: 'border-sky-300 bg-sky-50 text-sky-800',
  Academic: 'border-amber-300 bg-amber-50 text-amber-800',
  'Peer-reviewed': 'border-indigo-300 bg-indigo-50 text-indigo-800',
  'Scholarly index': 'border-violet-300 bg-violet-50 text-violet-800',
}

/** "Authentic data": the source tiers the search ranks by. TopBar's Sources link scrolls here (/#sources). */
export default function Sources() {
  return (
    <section id="sources" className="reveal scroll-mt-6">
      <SectionHeading eyebrow="Sources" title="Authentic data, direct from official & credible sources">
        The search ranks by authority: official and intergovernmental sources first, then peer-reviewed research.
      </SectionHeading>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {OFFICIAL_SOURCES.map(([name, tier]) => (
          <div
            key={name}
            className="flex flex-col items-start gap-2.5 rounded-2xl border-2 border-black/15 bg-white p-3.5 transition-all hover:-translate-y-0.5 hover:border-black hover:shadow-md sm:p-4"
          >
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${TIER_TONES[tier]}`}>
              {tier}
            </span>
            <span className="text-sm font-bold leading-snug text-ink">{name}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
