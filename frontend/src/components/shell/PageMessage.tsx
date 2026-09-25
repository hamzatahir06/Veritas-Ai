import type { ReactNode } from 'react'

/** A page's loading / empty / error state: one line of text in the page's own scroll container. */
export default function PageMessage({ error = false, children }: { error?: boolean; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={error ? 'text-red-600' : 'text-ink/50'}>{children}</div>
    </div>
  )
}
