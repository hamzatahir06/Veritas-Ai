import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [accessToken, setAccessToken] = useState<string>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const applySession = (session: Session | null) => {
      setUser(session?.user ?? null)
      setAccessToken(session?.access_token)
      setLoading(false)
    }

    // The stored session first, then every sign-in, sign-out and token refresh.
    supabase.auth.getSession().then(({ data: { session } }) => applySession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => applySession(session))
    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        // Always show Google's account chooser, so a user with several Google
        // accounts can pick one instead of being signed in silently.
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) console.error('Error signing in with Google:', error.message)
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Error signing out:', error.message)
  }

  return { isSignedIn: !!user, user, accessToken, loading, signInWithGoogle, signOut }
}
