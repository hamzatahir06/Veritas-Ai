/** A small brand-colored ring spinner for loading states. */
export default function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand ${className}`}
    />
  )
}
