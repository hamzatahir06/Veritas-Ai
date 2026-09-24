/** The Veritas mark (teal disc + magnifier with a check), inlined so it costs no extra request. */
export function LogoMark({ className = 'h-9 w-9' }: { className?: string }) {
  return (
    <svg viewBox="48 38 124 124" className={`shrink-0 ${className}`} aria-hidden="true">
      <circle cx="110" cy="100" r="62" fill="#2F9C8A" />
      <g transform="translate(34.1 25.9) scale(0.30)" fill="none" stroke="#FFFFFF" strokeLinecap="round">
        <circle cx="238" cy="232" r="104" strokeWidth="26" />
        <path d="M196 230 L230 268 L292 196" strokeWidth="26" strokeLinejoin="round" />
        <line x1="315" y1="309" x2="372" y2="366" strokeWidth="30" />
      </g>
    </svg>
  )
}

/** Logo lockup (mark + wordmark), shared by the TopBar, Sidebar and Footer. `onDark` for dark backgrounds. */
export default function BrandLogo({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="whitespace-nowrap text-xl tracking-tight">
        <span className={`font-semibold ${onDark ? 'text-white' : 'text-ink'}`}>Veritas</span>{' '}
        <span className="font-normal text-[#2F9C8A]">AI</span>
      </span>
    </span>
  )
}
