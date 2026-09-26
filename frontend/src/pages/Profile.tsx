import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { deleteAccount } from '../lib/api'
import { supabase } from '../lib/supabase'
import { usePageContext } from '../hooks/usePageContext'

const cardClass = 'rounded-2xl border border-black/10 bg-white p-6 shadow-xs'

export default function Profile() {
  const { isSignedIn, accessToken, user } = usePageContext()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isSignedIn || !user?.email || !accessToken) return <Navigate to="/" replace />

  const email = user.email
  const matches = typed.trim().toLowerCase() === email.toLowerCase()

  const closeConfirm = () => {
    setConfirming(false)
    setTyped('')
    setError(null)
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await deleteAccount(typed.trim(), accessToken)
      // The account no longer exists server-side; drop the local session too.
      await supabase.auth.signOut({ scope: 'local' })
      navigate('/', { replace: true })
    } catch (err) {
      setError((err as Error).message)
      setDeleting(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-10">
        <div>
          <h1 className="text-xl font-semibold text-ink">Profile</h1>
          <p className="mt-1 truncate text-sm text-ink/50">{email}</p>
        </div>

        {/* Plan — everyone is on Free until Pro launches */}
        <section className={cardClass}>
          <h2 className="text-xs font-semibold tracking-wide text-ink/50 uppercase">Current plan</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
            <span className="text-lg font-bold text-ink">Free plan</span>
            <Link
              to="/pricing"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Upgrade to Pro
            </Link>
          </div>
        </section>

        {/* Delete account */}
        <section className={cardClass}>
          <h2 className="text-xs font-semibold tracking-wide text-ink/50 uppercase">Delete account</h2>
          <p className="mt-3 text-sm text-ink/70">
            Permanently deletes your account, research projects, sources and documents. This cannot be undone.
          </p>
          <button
            onClick={() => setConfirming(true)}
            className="mt-4 cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700"
          >
            Delete account
          </button>
        </section>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={closeConfirm}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.key === 'Escape' && closeConfirm()}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h3 id="delete-title" className="text-lg font-semibold text-ink">Delete your account?</h3>
            <p className="mt-2 text-sm text-ink/70">
              Type <span className="font-semibold text-ink">{email}</span> to confirm.
            </p>
            <input
              type="email"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={email}
              autoFocus
              autoComplete="off"
              className="mt-4 w-full rounded-lg border border-black/15 px-3 py-2 text-sm text-ink outline-none focus:border-red-500"
            />
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={closeConfirm}
                className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-black/5"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={!matches || deleting}
                className="cursor-pointer rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? 'Deleting…' : 'Delete account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
