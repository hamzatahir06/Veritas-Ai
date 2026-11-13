import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProjectSummary } from '../../lib/projects'

type Props = {
  project: ProjectSummary
  onDelete: (id: string) => Promise<void>
}

const buttonClass = 'cursor-pointer rounded-lg px-3 py-1.5 text-xs transition-colors disabled:opacity-60'

export default function ProjectCard({ project, onDelete }: Props) {
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setDeleting(true)
    setError(null)
    try {
      await onDelete(project.id)
      // On success the parent removes this card; no need to reset state.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed.')
      setDeleting(false)
      setConfirming(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-black/10 bg-white px-5 py-4 transition-colors hover:border-brand/40">
      <div className="min-w-0 flex-1">
        <Link to={`/projects/${project.id}`} className="block">
          <div className="truncate font-medium text-ink">{project.title || project.topic}</div>
          <div className="mt-1 text-xs text-ink/40">
            {new Date(project.created_at).toLocaleDateString()}
          </div>
        </Link>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className={`${buttonClass} bg-red-600 font-semibold text-white hover:bg-red-700`}
          >
            {deleting ? 'Deleting…' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className={`${buttonClass} font-medium text-ink/60 hover:text-ink`}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Delete research"
          className={`${buttonClass} shrink-0 border border-red-200 font-semibold text-red-600 hover:bg-red-50`}
        >
          Delete
        </button>
      )}
    </div>
  )
}
