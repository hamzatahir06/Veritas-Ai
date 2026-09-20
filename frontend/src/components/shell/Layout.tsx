import { Outlet } from 'react-router-dom'
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
  return (
    <div className="flex h-screen overflow-hidden bg-[#fafafa]">
      {isSignedIn && <Sidebar />}
      <div className="flex h-screen flex-1 flex-col overflow-hidden">
        <TopBar isSignedIn={isSignedIn} user={user} onSignIn={onSignIn} onSignOut={onSignOut} />
        {/* Removed px-8 py-8 to let Home take the full height and touch the bottom edge cleanly */}
        <main className="flex-1 overflow-hidden">
          <Outlet context={{ isSignedIn, accessToken, user }} />
        </main>
      </div>
    </div>
  )
}