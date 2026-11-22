import { useOutletContext } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import type { ResearchThread } from './useResearchThread'

/** What Layout hands every page through its <Outlet>. */
export type PageContext = { isSignedIn: boolean; accessToken?: string; user: User | null; thread: ResearchThread }

export const usePageContext = () => useOutletContext<PageContext>()
