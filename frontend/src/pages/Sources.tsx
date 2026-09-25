import { useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import PageMessage from '../components/shell/PageMessage'
import { API_BASE } from '../lib/api'

type ContextType = { accessToken?: string }
type SourceItem = {
  id: string
  title: string
  url: string
  project_id: string
  created_at: string
  projects: { topic: string }
}

export default function Sources() {
  const { accessToken } = useOutletContext<ContextType>()
  const [sources, setSources] = useState<SourceItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken) return
    fetch(`${API_BASE}/api/sources`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load sources.')
        return res.json()
      })
      .then(setSources)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [accessToken])

  if (loading) return <PageMessage>Loading sources…</PageMessage>
  if (error) return <PageMessage error>{error}</PageMessage>
  if (sources.length === 0) return <PageMessage>No sources yet — start a research on Home.</PageMessage>

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <h1 className="mb-2 text-xl font-semibold text-ink">Sources</h1>
        {sources.map((s) => (
          <div key={s.id} className="rounded-xl border border-black/10 bg-white px-5 py-4">
            <a
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-dark underline decoration-brand/40 hover:decoration-brand"
            >
              {s.title || s.url}
            </a>
            <div className="mt-1 text-xs text-ink/40">
              From{' '}
              <Link to={`/projects/${s.project_id}`} className="underline hover:text-ink/60">
                {s.projects?.topic}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
