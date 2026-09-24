import { Link, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import BrandLogo, { LogoMark } from './BrandLogo'
import ContactMenu from './ContactMenu'

const underline = (
  <span className="absolute -bottom-1 left-0 right-0 h-[2.5px] rounded-full bg-brand shadow-sm" />
)

const navLinkClass = 'relative pb-1 text-base font-semibold text-ink transition-colors hover:text-black'

type TopBarProps = {
  isSignedIn: boolean
  user: User | null
  onSignIn: () => void
  onSignOut: () => void
  /** Mobile only: hamburger state — nav dropdown when signed out, sidebar drawer when signed in. */
  menuOpen: boolean
  onToggleMenu: () => void
}

export default function TopBar({ isSignedIn, user, onSignIn, onSignOut, menuOpen, onToggleMenu }: TopBarProps) {
  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : 'VA'

  // The "Sources" link is an in-page scroll target (/#sources), so the active
  // state is driven by the hash rather than by route matching.
  const location = useLocation()
  const onSources = location.hash === '#sources'
  const onHome = location.pathname === '/' && !onSources
  const onPricing = location.pathname === '/pricing'

  const navLinks = [
    { label: 'Home', to: '/', active: onHome },
    { label: 'Sources', to: '/#sources', active: onSources },
    { label: 'Pricing', to: '/pricing', active: onPricing },
  ]

  const menuButton = (
    <button
      onClick={onToggleMenu}
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={menuOpen}
      className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg text-ink transition-colors hover:bg-black/5 md:hidden"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
      </svg>
    </button>
  )

  return (
    <header className="ui-chrome relative z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-white px-4 md:px-6">

      {/* 1. TOP LEFT: Logo, then nav links (Only when NOT signed in; Sidebar handles nav otherwise) */}
      <div className="flex min-w-0 items-center gap-3 md:gap-10">
        {isSignedIn ? (
          // Signed in on mobile: the sidebar is a drawer, so the top bar carries the logo
          // (mark only, leaving room for Contact + Upgrade; the drawer shows the full lockup).
          <div className="flex items-center gap-2 md:hidden">
            {menuButton}
            <Link to="/" aria-label="Veritas AI home">
              <LogoMark />
            </Link>
          </div>
        ) : (
          <>
            <Link
              to="/"
              className="transition-opacity hover:opacity-80"
            >
              <BrandLogo />
            </Link>

            {navLinks.map(({ label, to, active }) => (
              <Link key={label} to={to} className={`hidden md:block ${navLinkClass}`}>
                {label}
                {active && underline}
              </Link>
            ))}
          </>
        )}
      </div>

      {/* 2. TOP RIGHT: Nav Links & Actions */}
      <div className="flex shrink-0 items-center gap-3 md:gap-6">

        {/* SIGNED IN: Contact menu + solid brand Upgrade button */}
        {isSignedIn && <ContactMenu />}
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
          <>
            <button
              onClick={onSignIn}
              className="cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
            >
              Sign up
            </button>
            {menuButton}
          </>
        )}
      </div>

      {/* Signed out, mobile: nav links drop down under the bar */}
      {!isSignedIn && menuOpen && (
        <nav className="absolute inset-x-0 top-full flex flex-col border-b border-black/5 bg-white px-4 py-2 shadow-lg md:hidden">
          {navLinks.map(({ label, to, active }) => (
            <Link
              key={label}
              to={to}
              className={`rounded-lg px-3 py-3 text-base font-semibold transition-colors ${
                active ? 'bg-brand/10 text-brand-dark' : 'text-ink hover:bg-black/5'
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
