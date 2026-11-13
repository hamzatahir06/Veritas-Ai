import { Navigate, Outlet } from 'react-router-dom'
import { usePageContext } from '../../hooks/usePageContext'

/** Wraps the signed-in routes: a visitor is sent home instead of seeing a page that can never load. */
export default function RequireAuth() {
  const context = usePageContext()
  if (!context.isSignedIn) return <Navigate to="/" replace />
  // Forwarded explicitly: a nested <Outlet> starts with no context of its own.
  return <Outlet context={context} />
}
