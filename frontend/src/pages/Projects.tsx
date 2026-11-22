import { Link } from 'react-router-dom'
import { deleteProject, type ProjectSummary } from '../lib/projects'
import ProjectCard from '../components/research/ProjectCard'
import ListPage from '../components/shell/ListPage'
import PageMessage from '../components/shell/PageMessage'
import { usePageContext } from '../hooks/usePageContext'
import { useApi } from '../hooks/useApi'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export default function Projects() {
  useDocumentTitle('Projects')
  const { accessToken } = usePageContext()
  const { data: projects, error, loading, setData } =
    useApi<ProjectSummary[]>('/api/projects', accessToken, 'Could not load projects.')

  async function handleDelete(id: string) {
    if (!accessToken) return
    await deleteProject(id, accessToken)
    setData((prev) => prev.filter((p) => p.id !== id))
  }

  if (error) return <PageMessage error>{error}</PageMessage>
  if (loading || !projects) return <PageMessage loading>Loading projects…</PageMessage>
  if (projects.length === 0) return (
    <PageMessage>
      No projects yet — <Link to="/" className="font-medium text-brand-dark underline decoration-brand/40 hover:decoration-brand">start a topic on Home</Link>.
    </PageMessage>
  )

  return (
    <ListPage title="Projects">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
      ))}
    </ListPage>
  )
}
