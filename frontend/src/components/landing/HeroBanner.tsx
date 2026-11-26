import BrainMark from './BrainMark'

export default function HeroBanner() {
  return (
    <div className="ui-chrome relative flex w-full items-center justify-between gap-4 overflow-hidden rounded-3xl bg-brand px-5 py-7 shadow-md sm:px-10 sm:py-10 lg:px-12 lg:py-12">
      {/* On phones the brain tucks into the top-right corner, so the copy keeps the full width. */}
      <div className="max-w-xl">
        <p className="mb-2 pr-24 font-serif text-lg font-medium italic text-white sm:pr-0">
          Research, done properly.
        </p>
        <h1 className="pr-24 text-2xl font-bold leading-tight text-balance text-white sm:pr-0 sm:text-3xl lg:text-[2.5rem]">
          Deep AI Research Agent
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-white sm:text-base lg:text-[17px]">
          Give it a topic. It searches official databases, checks primary sources, and hands you a cited brief — in minutes, not hours.
        </p>
      </div>
      <BrainMark className="absolute top-4 right-4 h-16 w-auto shrink-0 sm:static sm:h-28 md:h-36 lg:h-44" />
    </div>
  )
}
