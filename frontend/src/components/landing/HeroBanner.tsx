import BrainMark from './BrainMark'

export default function HeroBanner() {
  return (
    <div className="ui-chrome flex w-full items-center justify-between gap-4 overflow-hidden rounded-2xl bg-brand px-6 py-6 shadow-sm sm:px-10 sm:py-[36px]">
      <div className="max-w-md">
        <p className="mb-2 font-serif text-lg font-medium italic text-white/90">
          Research, done properly.
        </p>
        <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
          Deep AI Research Agent
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white/90 sm:text-base">
          Give it a topic. It searches official databases, checks primary sources, and hands you a cited brief — in minutes, not hours.
        </p>
      </div>
      <BrainMark className="h-20 w-auto shrink-0 sm:h-28 md:h-36" />
    </div>
  )
}
