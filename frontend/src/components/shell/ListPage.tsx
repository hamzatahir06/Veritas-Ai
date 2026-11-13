import type { ReactNode } from 'react'
import Page from './Page'

/** A titled list page (Projects, Sources). */
export default function ListPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page className="max-w-4xl gap-3">
      <h1 className="mb-2 text-xl font-semibold text-ink">{title}</h1>
      {children}
    </Page>
  )
}
