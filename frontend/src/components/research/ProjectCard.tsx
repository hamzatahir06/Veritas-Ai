import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { ProjectSummary } from '../../lib/projects'

type Props = {
  project: ProjectSummary
  onDelete: (id: string) => Promise<void>
}

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
      <Link to={`/projects/${project.id}`} className="min-w-0 flex-1">
        <div className="truncate font-medium text-ink">{project.title || project.topic}</div>
        <div className="mt-1 text-xs text-ink/40">
          {new Date(project.created_at).toLocaleDateString()}
        </div>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </Link>

      {confirming ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {deleting ? 'Deleting…' : 'Confirm'}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={deleting}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-ink/60 transition-colors hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="Delete research"
          className="shrink-0 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
        >
          Delete
        </button>
      )}
    </div>
  )
}
