import { NavLink, Link, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'

const underline = (
  <span className="absolute -bottom-1 left-0 right-0 h-[2.5px] rounded-full bg-brand shadow-sm" />
)

type TopBarProps = {
  isSignedIn: boolean
  user: User | null
  onSignIn: () => void
  onSignOut: () => void
}

export default function TopBar({ isSignedIn, user, onSignIn, onSignOut }: TopBarProps) {
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'VA'

  // The "Sources" link is an in-page scroll target (/#sources), so the active
  // state is driven by the hash rather than by route matching.
  const location = useLocation()
  const onSources = location.hash === '#sources'
  const onHome = location.pathname === '/' && !onSources

  return (
    <header className="ui-chrome flex h-16 items-center justify-between border-b border-black/5 bg-white px-6">
      
      {/* 1. TOP LEFT: Logo, then a "Home" nav link (Only when NOT signed in; Sidebar handles nav otherwise) */}
      <div className="flex items-center gap-10">
        {!isSignedIn && (
          <>
            <Link
              to="/"
              className="text-lg font-bold tracking-tight text-ink transition-opacity hover:opacity-80"
            >
              Veritas AI
            </Link>

            <Link
              to="/"
              className="relative pb-1 text-base font-semibold text-ink transition-colors hover:text-black"
            >
              Home
              {onHome && underline}
            </Link>

            <Link
              to="/#sources"
              className="relative pb-1 text-base font-semibold text-ink transition-colors hover:text-black"
            >
              Sources
              {onSources && underline}
            </Link>

            <NavLink
              to="/pricing"
              className="relative pb-1 text-base font-semibold text-ink transition-colors hover:text-black"
            >
              {({ isActive }) => (
                <>
                  Pricing
                  {isActive && underline}
                </>
              )}
            </NavLink>
          </>
        )}
      </div>

      {/* 2. TOP RIGHT: Nav Links & Actions */}
      <div className="flex items-center gap-6">

        {/* SIGNED IN: Solid Brand Button */}
        {isSignedIn && (
          <Link
            to="/pricing"
            className="rounded-lg bg-brand px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            Upgrade
          </Link>
        )}

        {/* Auth Buttons */}
        {isSignedIn ? (
          <button
            onClick={onSignOut}
            title={user?.email ? `Signed in as ${user.email}` : 'Sign out'}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-brand/20 text-sm font-semibold text-brand-dark hover:bg-brand/30"
          >
            {initials}
          </button>
        ) : (
          <button
            onClick={onSignIn}
            className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Sign up
          </button>
        )}
      </div>
    </header>
  )
}