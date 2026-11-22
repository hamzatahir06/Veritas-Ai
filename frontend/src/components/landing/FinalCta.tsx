import { Link } from 'react-router-dom'

/** Closing call to action: back to the prompt box at the top, or on to Pricing. */
export default function FinalCta({ onStart }: { onStart: () => void }) {
  return (
    <section className="reveal relative overflow-hidden rounded-3xl border-2 border-black bg-ink px-6 py-12 text-center shadow-lg sm:px-12 sm:py-14">
      <div aria-hidden="true" className="cta-glow pointer-events-none absolute inset-0" />
      <div className="relative mx-auto flex max-w-xl flex-col items-center gap-4">
        <h2 className="text-2xl font-extrabold tracking-tight text-balance text-white sm:text-3xl">
          Your next brief is one question away
        </h2>
        <p className="text-sm text-balance text-white/85 sm:text-base">
          No sign-up needed to try it. Ask anything — get a structured, cited brief in minutes.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={onStart}
            className="cursor-pointer rounded-xl bg-brand px-6 py-3 text-sm font-bold text-black shadow-[0_8px_24px_-6px_var(--color-brand)] transition-all hover:-translate-y-0.5 hover:bg-white active:translate-y-0"
          >
            Start researching — free
          </button>
          <Link
            to="/pricing"
            className="rounded-xl border-2 border-white/60 px-6 py-3 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white/10"
          >
            See pricing
          </Link>
        </div>
      </div>
    </section>
  )
}
