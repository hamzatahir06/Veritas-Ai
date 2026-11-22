import SectionHeading from './SectionHeading'

/**
 * Honest answers only: each one matches what the product does today (and the
 * Pricing page copy). Native <details> = keyboard + screen-reader support with no JS.
 */
const FAQ: [string, string][] = [
  [
    'Is Veritas AI free?',
    'Yes. Free Starter includes 3 research briefs a day with scholarly search, PDF and Word export and a saved library. Pro (18 briefs a day) is on a free waitlist — no card needed.',
  ],
  [
    'Do I need an account?',
    'No. Guests can run a full brief and download it; nothing about a guest run is stored. Sign in with Google when you want your briefs and sources saved.',
  ],
  [
    'Where do the sources come from?',
    'Live web search plus peer-reviewed literature from OpenAlex. Government, university and intergovernmental sources rank first, results below a relevance floor are dropped, and forums such as Reddit and Quora are excluded.',
  ],
  [
    'How are citations handled?',
    'Claims are cited IEEE-style, numbered at the claim. In the app every [n] links straight to its source, and the PDF and Word exports end with the full numbered reference list.',
  ],
  [
    'Can it make things up?',
    'The agent is instructed to write only from the sources it found and to flag gaps under Limitations rather than fill them from memory — and because every claim is cited, you can check it. As with any AI tool, verify anything important against the source.',
  ],
  [
    'How long does a brief take?',
    'Usually a few minutes. You watch each search and the sources it finds live while the brief is written.',
  ],
  [
    'What if the AI model is busy?',
    'A backup model takes over automatically and continues from the research already gathered, so a busy provider does not cost you the run.',
  ],
]

export default function Faq() {
  return (
    <section className="reveal">
      <SectionHeading eyebrow="FAQ" title="Questions, answered" />
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {FAQ.map(([q, a]) => (
          <details
            key={q}
            className="group rounded-xl border-2 border-black/15 bg-white px-4 transition-colors open:border-brand hover:border-black/40 sm:px-5"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {q}
              <span
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-black/20 text-lg leading-none text-ink transition-transform duration-200 group-open:rotate-45 group-open:border-brand group-open:bg-brand group-open:text-white"
              >
                +
              </span>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-ink/85">{a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
