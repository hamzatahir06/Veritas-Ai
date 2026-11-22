import type { ReactNode } from 'react'

/** Eyebrow + title + optional lede, centred: the shared heading for home-page sections. */
export default function SectionHeading({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mx-auto mb-8 flex max-w-2xl flex-col items-center gap-3 text-center">
      <span className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-widest text-brand-dark">
        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
        {eyebrow}
      </span>
      <h2 className="text-2xl font-extrabold tracking-tight text-balance text-ink sm:text-3xl">{title}</h2>
      {children && <p className="text-sm text-balance text-ink/75 sm:text-base">{children}</p>}
    </div>
  )
}
