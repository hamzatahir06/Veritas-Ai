import { lazy, Suspense } from 'react'
import { useParams, Link } from 'react-router-dom'
import PromptBubble from '../components/research/PromptBubble'
import Page from '../components/shell/Page'
import PageMessage from '../components/shell/PageMessage'
import { usePageContext } from '../hooks/usePageContext'
import { useApi } from '../hooks/useApi'
import type { Source } from '../lib/api'

// The markdown renderer is the heaviest part of the bundle; load it with the brief.
const ResultView = lazy(() => import('../components/research/ResultView'))

type ProjectDetailData = {
  id: string
  topic: string
  markdown: string
  provider?: string
  sources: Source[]
}

export default function ProjectDetail() {
  const { id = '' } = useParams()
  const { accessToken } = usePageContext()
  const { data: project, error, loading } =
    useApi<ProjectDetailData>(`/api/projects/${id}`, accessToken, 'Project not found.')

  if (error) return <PageMessage error>{error}</PageMessage>
  if (loading || !project) return <PageMessage>Loading…</PageMessage>

  return (
    <Page className="max-w-4xl gap-4">
      <Link to="/projects" className="text-sm text-ink/50 hover:text-ink">
        ← Back to Projects
      </Link>
      <PromptBubble topic={project.topic} />
      <Suspense fallback={null}>
        <ResultView
          result={{
            type: 'done',
            project_id: project.id,
            saved: true,
            topic: project.topic,
            markdown: project.markdown,
            sources: project.sources,
            provider: project.provider || '',
          }}
          accessToken={accessToken}
        />
      </Suspense>
    </Page>
  )
}
