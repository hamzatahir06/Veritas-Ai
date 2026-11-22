/** A Lucide outline icon (ISC licence), drawn from its path data. */
export default function LucideIcon({ paths, className = 'h-5 w-5' }: { paths: string[]; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths.map((d) => <path key={d} d={d} />)}
    </svg>
  )
}
