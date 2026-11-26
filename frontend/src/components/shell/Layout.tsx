import { Suspense, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import PageMessage from './PageMessage'
import ErrorBoundary from './ErrorBoundary'
import { useResearchThread } from '../../hooks/useResearchThread'
import type { User } from '@supabase/supabase-js'
import type { PageContext } from '../../hooks/usePageContext'

type LayoutProps = {
  isSignedIn: boolean
  user: User | null
  accessToken?: string
  onSignIn: () => void
  onSignOut: () => void
}

export default function Layout({ isSignedIn, user, accessToken, onSignIn, onSignOut }: LayoutProps) {
  // The mobile menu remembers which location it was opened on, so any navigation closes it.
  const location = useLocation()
  const [menuOpenAt, setMenuOpenAt] = useState<string | null>(null)
  const menuOpen = menuOpenAt === location.key
  const toggleMenu = () => setMenuOpenAt(menuOpen ? null : location.key)
  const closeMenu = () => setMenuOpenAt(null)
  // Lives here, above the routes, so leaving Home doesn't drop a run or its brief.
  const thread = useResearchThread()
  // ...but one person's briefs must not stay on screen for the next: sign-out
  // (or account deletion) clears the thread.
  const { reset } = thread
  const userId = user?.id
  useEffect(() => reset(), [userId, reset])

  return (
    <div className="flex h-dvh overflow-hidden bg-neutral-50">
      {isSignedIn && (
        <>
          {/* Docked from lg: on tablets a fixed 240px column would take a third of the screen. */}
          <div className="hidden lg:flex">
            <Sidebar />
          </div>

          {/* Phones + tablets: the same sidebar as a slide-in drawer */}
          <div
            inert={!menuOpen}
            onKeyDown={(e) => e.key === 'Escape' && closeMenu()}
            className="fixed inset-0 z-40 lg:hidden"
          >
            <div
              onClick={closeMenu}
              className={`absolute inset-0 bg-black/40 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
            />
            <div
              className={`relative h-full w-64 max-w-[85vw] shadow-xl transition-transform duration-200 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
              <Sidebar />
            </div>
          </div>
        </>
      )}
      <div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          isSignedIn={isSignedIn}
          user={user}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          menuOpen={menuOpen}
          onToggleMenu={toggleMenu}
          hasGuestThread={!isSignedIn && thread.turns.length > 0}
          onLeaveThread={reset}
        />
        {/* No padding here: pages own their scroll and padding, so Home's prompt bar sits flush with the bottom */}
        <main className="flex-1 overflow-hidden">
          {/* Pages other than Home are code-split; this is what shows while one loads. */}
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<PageMessage loading>Loading…</PageMessage>}>
              <Outlet context={{ isSignedIn, accessToken, user, thread } satisfies PageContext} />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  )
}
