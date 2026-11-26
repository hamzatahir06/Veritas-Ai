import { useState, type MouseEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import BrandLogo, { LogoMark } from './BrandLogo'
import ConfirmDialog from './ConfirmDialog'
import ContactMenu from './ContactMenu'
import AccountMenu from './AccountMenu'
import { SITE_LINKS } from '../../lib/siteLinks'

// Desktop nav: soft pills; the current page gets a brand tint instead of an underline.
const navLinkClass = (active: boolean) =>
  `rounded-lg px-3 py-2 text-[15px] font-medium transition-colors ${
    active ? 'bg-brand/20 text-brand' : 'text-white/90 hover:bg-white/10 hover:text-white'
  }`
const ctaClass =
  'cursor-pointer rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black shadow-[0_0_18px_-4px_var(--color-brand)] transition-colors hover:bg-white active:scale-[0.97]'

type TopBarProps = {
  isSignedIn: boolean
  user: User | null
  onSignIn: () => void
  onSignOut: () => void
  /** Mobile only: hamburger state — nav dropdown when signed out, sidebar drawer when signed in. */
  menuOpen: boolean
  onToggleMenu: () => void
  /** Signed out with a research thread on screen: the logo and Home link ask before clearing it. */
  hasGuestThread: boolean
  onLeaveThread: () => void
}

export default function TopBar({ isSignedIn, user, onSignIn, onSignOut, menuOpen, onToggleMenu, hasGuestThread, onLeaveThread }: TopBarProps) {
  // In-page links (/#sources) are scroll targets on Home, so their
  // active state comes from the hash rather than route matching.
  const location = useLocation()
  const navLinks = SITE_LINKS.map((l) => ({ ...l, active: l.to === location.pathname + location.hash }))

  // Guests' research is never saved, so any link back to the landing page throws it away:
  // ask first, then go where the link pointed. Off Home (e.g. /pricing) these links just
  // return to the thread, so no prompt there.
  const [pendingTo, setPendingTo] = useState<string | null>(null)
  const navigate = useNavigate()
  /** Click handler for a link into Home ('/' or '/#…'); other links get none. */
  const guardHome = (to: string) =>
    to === '/' || to.startsWith('/#')
      ? (e: MouseEvent) => {
          if (!hasGuestThread || location.pathname !== '/') return
          e.preventDefault()
          setPendingTo(to)
        }
      : undefined
  const leave = () => {
    onLeaveThread()
    navigate(pendingTo ?? '/')
    setPendingTo(null)
  }

  // Signed out the nav links fit inline from md; signed in the sidebar only docks from lg.
  const menuButton = (
    <button
      onClick={onToggleMenu}
      aria-label={menuOpen ? 'Close menu' : 'Open menu'}
      aria-expanded={menuOpen}
      className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-white transition-colors hover:bg-white/10 ${isSignedIn ? 'lg:hidden' : 'md:hidden'}`}
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
      </svg>
    </button>
  )

  return (
    <header className="ui-chrome relative z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b border-brand/40 bg-black bg-[radial-gradient(ellipse_60%_120%_at_0%_0%,color-mix(in_srgb,var(--color-brand)_22%,transparent),transparent_70%)] px-3 sm:px-5 lg:px-8">
      {/* Left: logo, plus the nav links when signed out (signed in, the sidebar carries nav). */}
      <div className="flex min-w-0 items-center gap-3 md:gap-8">
        {isSignedIn ? (
          // Signed in below lg: the sidebar is a drawer, so the top bar carries the logo
          // (mark only on phones, leaving room for Contact + Upgrade; full lockup from sm).
          <div className="flex items-center gap-1 lg:hidden">
            {menuButton}
            <Link to="/" aria-label="Veritas AI home" className="transition-opacity hover:opacity-80">
              <span className="sm:hidden"><LogoMark /></span>
              <span className="hidden sm:block"><BrandLogo onDark /></span>
            </Link>
          </div>
        ) : (
          <>
            <Link to="/" onClick={guardHome('/')} aria-label="Veritas AI home" className="transition-opacity hover:opacity-80">
              <BrandLogo onDark />
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map(({ label, to, active }) => (
                <Link
                  key={label}
                  to={to}
                  onClick={guardHome(to)}
                  aria-current={active ? 'page' : undefined}
                  className={navLinkClass(active)}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        {isSignedIn ? (
          <>
            <ContactMenu />
            <Link to="/pricing" className={ctaClass}>
              Upgrade
            </Link>
            <AccountMenu user={user} onSignOut={onSignOut} />
          </>
        ) : (
          <>
            <button onClick={onSignIn} className={ctaClass}>
              Sign up
            </button>
            {menuButton}
          </>
        )}
      </div>

      {/* Signed out, mobile: nav links drop down under the bar; tapping outside closes them */}
      {!isSignedIn && menuOpen && (
        <>
          <div onClick={onToggleMenu} className="fixed inset-0 top-16 md:hidden" />
          <nav className="absolute inset-x-0 top-full flex animate-pop-in flex-col gap-0.5 border-b border-brand/40 bg-black px-3 py-2 shadow-lg md:hidden">
            {navLinks.map(({ label, to, active }) => (
              <Link
                key={label}
                to={to}
                onClick={guardHome(to)}
                className={`rounded-lg px-3 py-3 text-base font-semibold transition-colors ${
                  active ? 'bg-brand/20 text-brand' : 'text-white hover:bg-white/10'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </>
      )}

      <ConfirmDialog
        open={pendingTo !== null}
        title="Leave this research?"
        confirmLabel="Leave and clear"
        onConfirm={leave}
        onCancel={() => setPendingTo(null)}
      >
        Going back to the home page will clear this research and its brief. Guest research isn't
        saved, so download the brief first if you want to keep it, or sign up to save briefs
        automatically.
      </ConfirmDialog>
    </header>
  )
}
