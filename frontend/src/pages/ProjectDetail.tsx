import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import ResultView from '../components/research/ResultView'
import PageMessage from '../components/shell/PageMessage'
import { usePageContext } from '../hooks/usePageContext'
import { getJson, type DoneEvent } from '../lib/api'

type ProjectDetailData = {
  id: string
  topic: string
  markdown: string
  provider?: string
  sources: DoneEvent['sources']
}

export default function ProjectDetail() {
  const { id } = useParams()
  const { accessToken } = usePageContext()
  const [project, setProject] = useState<ProjectDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !id) return
    getJson<ProjectDetailData>(`/api/projects/${id}`, accessToken, 'Project not found.')
      .then(setProject)
      .catch((err) => setError(err.message))
  }, [accessToken, id])

  if (error) return <PageMessage error>{error}</PageMessage>
  if (!project) return <PageMessage>Loading…</PageMessage>

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Link to="/projects" className="text-sm text-ink/50 hover:text-ink">
          ← Back to Projects
        </Link>
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
      </div>
    </div>
  )
}
