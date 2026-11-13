import { deleteProject, type ProjectSummary } from '../lib/projects'
import ProjectCard from '../components/research/ProjectCard'
import ListPage from '../components/shell/ListPage'
import PageMessage from '../components/shell/PageMessage'
import { usePageContext } from '../hooks/usePageContext'
import { useApi } from '../hooks/useApi'

export default function Projects() {
  const { accessToken } = usePageContext()
  const { data: projects, error, loading, setData } =
    useApi<ProjectSummary[]>('/api/projects', accessToken, 'Could not load projects.')

  async function handleDelete(id: string) {
    if (!accessToken) return
    await deleteProject(id, accessToken)
    setData((prev) => prev.filter((p) => p.id !== id))
  }

  if (error) return <PageMessage error>{error}</PageMessage>
  if (loading || !projects) return <PageMessage>Loading projects…</PageMessage>
  if (projects.length === 0) return <PageMessage>No projects yet — start a topic on Home.</PageMessage>

  return (
    <ListPage title="Projects">
      {projects.map((p) => (
        <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
      ))}
    </ListPage>
  )
}
