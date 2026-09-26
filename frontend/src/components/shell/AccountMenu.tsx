import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

const itemClass = 'flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors'

/** Signed-in avatar in the top bar: opens a small card with Profile and Sign out. */
export default function AccountMenu({ user, onSignOut }: { user: User | null; onSignOut: () => void }) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'VA'

  return (
    <div className="relative" onKeyDown={(e) => e.key === 'Escape' && close()}>
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand-dark hover:bg-brand/30"
      >
        {initials}
      </button>

      {open && (
        <>
          {/* Click-away layer */}
          <div className="fixed inset-0 z-40" onClick={close} />
          <div className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-black/10 bg-white p-1 shadow-lg">
            {user?.email && (
              <div className="truncate border-b border-black/5 px-3 py-2.5 text-xs text-ink/50">{user.email}</div>
            )}
            <Link to="/profile" onClick={close} className={`${itemClass} text-ink hover:bg-black/5`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
              </svg>
              Profile
            </Link>
            <button onClick={() => { close(); onSignOut() }} className={`${itemClass} text-red-600 hover:bg-red-50`}>
              {/* Power icon */}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="h-5 w-5">
                <path d="M12 3v8" />
                <path d="M7 6.3a8 8 0 1 0 10 0" />
              </svg>
              Sign out
            </button>
          </div>
        </>
      )}
    </div>
  )
}
