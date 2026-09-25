import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  // typed as string | undefined to match optional prop types (LayoutProps)
  const [accessToken, setAccessToken] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    const applySession = (session: Session | null) => {
      setUser(session?.user ?? null)
      setAccessToken(session?.access_token ?? undefined)
      setLoading(false)
    }

    // 1. Fetch initial session state on component mount
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))

    // 2. Listen for real-time auth changes (Sign In, Sign Out, Token Refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))

    return () => subscription.unsubscribe()
  }, [])

  // 1-Click Google Sign In (Passwordless)
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    })

    if (error) {
      console.error('Error signing in with Google:', error.message)
    }
  }

  // Sign Out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) {
      console.error('Error signing out:', error.message)
    }
  }

  return {
    isSignedIn: !!user,
    user,
    accessToken,
    loading,
    signInWithGoogle,
    signOut,
  }
}
