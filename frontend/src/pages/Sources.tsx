import { Link } from 'react-router-dom'
import ListPage from '../components/shell/ListPage'
import PageMessage from '../components/shell/PageMessage'
import { usePageContext } from '../hooks/usePageContext'
import { useApi } from '../hooks/useApi'
import { domainOf } from '../lib/url'

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
  if (loading || !sources) return <PageMessage loading>Loading sources…</PageMessage>
  if (sources.length === 0) return (
    <PageMessage>
      No sources yet — <Link to="/" className="font-medium text-brand-dark underline decoration-brand/40 hover:decoration-brand">run a research brief on Home</Link>.
    </PageMessage>
  )

  return (
    <ListPage title="Sources">
      {sources.map((s) => (
        <div key={s.id} className="animate-fade-up rounded-xl border border-black/15 bg-white px-4 py-3.5 transition-colors hover:border-brand/50 sm:px-5 sm:py-4">
          <a
            href={s.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium wrap-anywhere text-brand-dark underline decoration-brand/40 transition-colors hover:decoration-brand"
          >
            {s.title || s.url}
          </a>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-ink/70">
            <span>{domainOf(s.url)}</span>
            <span aria-hidden="true">·</span>
            <span className="min-w-0">
              From{' '}
              <Link to={`/projects/${s.project_id}`} className="underline decoration-ink/30 hover:text-ink">
                {s.projects?.topic}
              </Link>
            </span>
          </div>
        </div>
      ))}
    </ListPage>
  )
}
