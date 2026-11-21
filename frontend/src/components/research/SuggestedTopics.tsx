type SuggestedTopicsProps = {
  onSelect: (topic: string) => void
}

const PROMPT_SUGGESTIONS = [
  'Impact of solid-state battery breakthroughs on EV supply chains in 2026',
  'Compare SEC Form 10-K risk disclosures for top AI hardware vendors',
  'Summary of recent FTC antitrust guidelines on algorithmic pricing',
  'Peer-reviewed analysis of nuclear fusion plasma containment progress',
]

export default function SuggestedTopics({ onSelect }: SuggestedTopicsProps) {
  return (
    <div className="flex w-full flex-col items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink/70">
        Or try one of these research topics:
      </span>
      {/* Phones: one swipeable row that bleeds to the screen edges (stacked, the four
          chips filled the whole first screen). From sm they wrap, centred. */}
      <div className="no-scrollbar -mx-4 flex w-[calc(100%+2rem)] snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:w-full sm:snap-none sm:flex-wrap sm:justify-center sm:overflow-visible sm:px-0">
        {PROMPT_SUGGESTIONS.map((topic) => (
          <button
            key={topic}
            onClick={() => onSelect(topic)}
            className="w-64 shrink-0 cursor-pointer snap-start rounded-2xl border-2 border-black bg-white px-4 py-2.5 text-left text-xs font-bold text-ink shadow-2xs transition-all hover:bg-black hover:text-white active:scale-[0.98] sm:w-auto sm:py-2 sm:text-center"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  )
}
