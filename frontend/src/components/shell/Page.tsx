import type { ReactNode } from 'react'

/**
 * A page's scroll container with the standard gutter and centred column.
 * Layout's <main> carries no padding on purpose (the chat prompt bar sits
 * flush with the bottom), so every non-chat page starts from this.
 */
export default function Page({ className = 'max-w-4xl', children }: { className?: string; children: ReactNode }) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={`mx-auto flex w-full flex-col px-4 py-6 ${className}`}>{children}</div>
    </div>
  )
}
