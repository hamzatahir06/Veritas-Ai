import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import type { User } from '@supabase/supabase-js'

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

  return (
    <div className="flex h-screen overflow-hidden bg-[#fafafa]">
      {isSignedIn && (
        <>
          <div className="hidden md:flex">
            <Sidebar />
          </div>

          {/* Mobile: the same sidebar as a slide-in drawer */}
          <div inert={!menuOpen} className="fixed inset-0 z-40 md:hidden">
            <div
              onClick={closeMenu}
              className={`absolute inset-0 bg-black/30 transition-opacity ${menuOpen ? 'opacity-100' : 'opacity-0'}`}
            />
            <div
              className={`relative h-full w-60 shadow-xl transition-transform duration-200 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
              <Sidebar />
            </div>
          </div>
        </>
      )}
      <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          isSignedIn={isSignedIn}
          user={user}
          onSignIn={onSignIn}
          onSignOut={onSignOut}
          menuOpen={menuOpen}
          onToggleMenu={toggleMenu}
        />
        {/* Removed px-8 py-8 to let Home take the full height and touch the bottom edge cleanly */}
        <main className="flex-1 overflow-hidden">
          <Outlet context={{ isSignedIn, accessToken, user }} />
        </main>
      </div>
    </div>
  )
}
