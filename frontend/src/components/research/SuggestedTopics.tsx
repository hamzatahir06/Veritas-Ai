import LucideIcon from '../shell/LucideIcon'

type SuggestedTopicsProps = {
  onSelect: (topic: string) => void
}

/** [topic, Lucide icon paths] — serious questions that need real sources and reasoning, one per field. */
const SUGGESTIONS: [string, string[]][] = [
  ['GLP-1 drugs and long-term cardiovascular outcomes', [
    'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z',
  ]],
  ['How the EU AI Act regulates high-risk systems', [
    'm16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z', 'm2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z',
    'M7 21h10', 'M12 3v18', 'M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2',
  ]],
  ['Solid-state batteries and EV supply chain risk', [
    'M15 7h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2', 'M6 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h1', 'm11 7-3 5h4l-3 5', 'M22 11v2',
  ]],
  ['Evidence on central bank rate cuts and inflation', ['M16 7h6v6', 'm22 7-8.5 8.5-5-5L2 17']],
]

/** Light, single-line pills under the prompt — suggestions, not another block of cards. */
export default function SuggestedTopics({ onSelect }: SuggestedTopicsProps) {
  return (
    <div className="flex max-w-3xl flex-wrap justify-center gap-2">
      {SUGGESTIONS.map(([topic, icon], i) => (
        <button
          key={topic}
          type="button"
          onClick={() => onSelect(topic)}
          style={{ animationDelay: `${i * 60}ms` }}
          className="group inline-flex animate-fade-up cursor-pointer items-center gap-1.5 rounded-full border border-black/20 bg-white/80 px-3 py-1.5 text-sm text-ink transition-colors hover:border-brand hover:bg-white hover:text-brand-dark active:scale-[0.97]"
        >
          <LucideIcon paths={icon} className="h-3.5 w-3.5 shrink-0 text-brand-dark" />
          {topic}
        </button>
      ))}
    </div>
  )
}
