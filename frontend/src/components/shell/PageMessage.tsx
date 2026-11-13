import type { ReactNode } from 'react'
import Page from './Page'

/** A page's loading / empty / error state: one line of text in the page's own scroll container. */
export default function PageMessage({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return (
    <Page>
      <div className={error ? 'text-red-600' : 'text-ink/50'}>{children}</div>
    </Page>
  )
}
