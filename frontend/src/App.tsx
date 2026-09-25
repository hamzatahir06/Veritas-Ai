import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/shell/Layout'
import Home from './pages/Home'
import Projects from './pages/Projects'
import ProjectDetail from './pages/ProjectDetail'
import Sources from './pages/Sources'
import { useAuth } from './hooks/useAuth'
import Pricing from './pages/Pricing'

export default function App() {
  const { isSignedIn, user, accessToken, loading, signInWithGoogle, signOut } = useAuth()

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink/40">Loading…</div>
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
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetail />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/sources" element={<Sources />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
