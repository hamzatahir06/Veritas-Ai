import { useEffect, useState } from 'react'
import { useParams, useOutletContext, Link } from 'react-router-dom'
import ResultView from '../components/research/ResultView'
import PageMessage from '../components/shell/PageMessage'
import { API_BASE } from '../lib/api'

type ContextType = { accessToken?: string }

type ProjectDetailData = {
  id: string
  topic: string
  markdown: string
  provider?: string
  sources: { query: string; title: string; url: string; snippet: string }[]
}

export default function ProjectDetail() {
  const { id } = useParams()
  const { accessToken } = useOutletContext<ContextType>()
  const [project, setProject] = useState<ProjectDetailData | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!accessToken || !id) return
    fetch(`${API_BASE}/api/projects/${id}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((res) => {
        if (!res.ok) throw new Error('Project not found.')
        return res.json()
      })
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
