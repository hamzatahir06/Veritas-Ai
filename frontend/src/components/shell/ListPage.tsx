import type { ReactNode } from 'react'

/** A titled list page (Projects, Sources): its own scroll container and a centred column. */
export default function ListPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <h1 className="mb-2 text-xl font-semibold text-ink">{title}</h1>
        {children}
      </div>
    </div>
  )
}
