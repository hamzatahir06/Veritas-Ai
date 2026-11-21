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
    <div className="group flex animate-fade-up items-center gap-3 rounded-xl border border-black/15 bg-white px-4 py-3.5 sm:px-5 sm:py-4 transition-all hover:border-brand/40 hover:shadow-sm">
      <div className="min-w-0 flex-1">
        <Link to={`/projects/${project.id}`} className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="line-clamp-2 font-medium wrap-break-word text-ink transition-colors group-hover:text-brand-dark">
              {project.title || project.topic}
            </div>
            <div className="mt-1 text-xs text-ink/70">
              {new Date(project.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <span aria-hidden="true" className="hidden text-ink/50 transition-transform sm:inline group-hover:translate-x-0.5 group-hover:text-brand-dark">
            →
          </span>
        </Link>
        {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
      </div>

      {confirming ? (
        <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:flex-row sm:items-center sm:gap-2">
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
            className={`${buttonClass} font-medium text-ink/80 hover:bg-black/5 hover:text-ink`}
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
