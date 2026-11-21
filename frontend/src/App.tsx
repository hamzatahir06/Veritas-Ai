import { lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/shell/Layout'
import RequireAuth from './components/shell/RequireAuth'
import Spinner from './components/shell/Spinner'
import Home from './pages/Home'
import { useAuth } from './hooks/useAuth'

// Home is the landing page and stays in the main bundle; everything else loads on first visit.
const Projects = lazy(() => import('./pages/Projects'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Sources = lazy(() => import('./pages/Sources'))
const Pricing = lazy(() => import('./pages/Pricing'))
const Profile = lazy(() => import('./pages/Profile'))

export default function App() {
  const { isSignedIn, user, accessToken, loading, signInWithGoogle, signOut } = useAuth()

  if (loading) {
    return (
      <div role="status" className="flex min-h-dvh items-center justify-center gap-2.5 text-ink/60">
        <Spinner />
        Loading…
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <Layout isSignedIn={isSignedIn} user={user} accessToken={accessToken} onSignIn={signInWithGoogle} onSignOut={signOut} />
          }
        >
          <Route path="/" element={<Home />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route element={<RequireAuth />}>
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
