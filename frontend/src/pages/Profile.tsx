import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { deleteAccount } from '../lib/api'
import ConfirmDialog from '../components/shell/ConfirmDialog'
import { supabase } from '../lib/supabase'
import { useDocumentTitle } from '../hooks/useDocumentTitle'
import { usePageContext } from '../hooks/usePageContext'

const cardClass = 'rounded-2xl border border-black/25 bg-white p-6 shadow-xs'

export default function Profile() {
  useDocumentTitle('Profile')
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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Profile</h1>
          <p className="mt-1 truncate text-sm text-ink">{email}</p>
        </div>

        {/* Plan — everyone is on Free until Pro launches */}
        <section className={cardClass}>
          <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">Current plan</h2>
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
          <h2 className="text-xs font-semibold tracking-wide text-ink uppercase">Delete account</h2>
          <p className="mt-3 text-sm text-ink">
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

      <ConfirmDialog
        open={confirming}
        title="Delete your account?"
        confirmLabel={deleting ? 'Deleting…' : 'Delete account'}
        cancelLabel="Cancel"
        confirmDisabled={!matches || deleting}
        onConfirm={handleDelete}
        onCancel={closeConfirm}
      >
        <label htmlFor="confirm-email">
          Type <span className="font-semibold">{email}</span> to confirm.
        </label>
        <input
          id="confirm-email"
          type="email"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && matches && !deleting && handleDelete()}
          placeholder={email}
          autoComplete="off"
          className="mt-3 w-full rounded-lg border border-black/25 px-3 py-2 text-base text-ink outline-none focus:border-red-500 sm:text-sm"
        />
        {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
      </ConfirmDialog>
    </div>
  )
}
