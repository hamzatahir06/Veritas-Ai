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
    <div className="flex flex-col items-center gap-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-ink/50">
        Or test the agent with an official research:
      </span>
      <div className="flex flex-wrap justify-center gap-2.5">
        {PROMPT_SUGGESTIONS.map((topic) => (
          <button
            key={topic}
            onClick={() => onSelect(topic)}
            className="cursor-pointer rounded-2xl border-2 border-black bg-white px-4 py-2 text-xs font-bold text-ink shadow-2xs transition-all hover:bg-black hover:text-white"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  )
}