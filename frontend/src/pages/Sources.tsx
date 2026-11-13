import { Link } from 'react-router-dom'
import ListPage from '../components/shell/ListPage'
import PageMessage from '../components/shell/PageMessage'
import { usePageContext } from '../hooks/usePageContext'
import { useApi } from '../hooks/useApi'

type SourceItem = {
  id: string
  title: string
  url: string
  project_id: string
  created_at: string
  projects: { topic: string }
}

export default function Sources() {
  const { accessToken } = usePageContext()
  const { data: sources, error, loading } =
    useApi<SourceItem[]>('/api/sources', accessToken, 'Could not load sources.')

  if (error) return <PageMessage error>{error}</PageMessage>
  if (loading || !sources) return <PageMessage>Loading sources…</PageMessage>
  if (sources.length === 0) return <PageMessage>No sources yet — run a research brief on Home.</PageMessage>

  return (
    <ListPage title="Sources">
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
    </ListPage>
  )
}
