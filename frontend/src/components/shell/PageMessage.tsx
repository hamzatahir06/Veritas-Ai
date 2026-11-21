import type { ReactNode } from 'react'
import Page from './Page'
import Spinner from './Spinner'

/** A page's loading / empty / error state: one line of text in the page's own scroll container. */
export default function PageMessage({ error = false, loading = false, children }: {
  error?: boolean
  loading?: boolean
  children: ReactNode
}) {
  return (
    <Page>
      <div
        role={error ? 'alert' : 'status'}
        className={`flex animate-fade-up items-center gap-2.5 ${error ? 'text-red-600' : 'text-ink/70'}`}
      >
        {loading && <Spinner />}
        <span>{children}</span>
      </div>
    </Page>
  )
}
