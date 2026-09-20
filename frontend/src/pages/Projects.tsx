import { useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { listProjects, deleteProject, type ProjectSummary } from '../lib/projects'
import ProjectCard from '../components/research/ProjectCard'

type ContextType = { accessToken?: string }

export default function Projects() {
  const { accessToken } = useOutletContext<ContextType>()
  // null = the fetch for the current token hasn't resolved yet.
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Derived rather than stored: we are loading exactly while a signed-in user's
  // request is still outstanding. Keeping it in state would mean setting it
  // synchronously inside the effect on the signed-out path.
  const loading = Boolean(accessToken) && projects === null && error === null

  useEffect(() => {
    if (!accessToken) return

    let isMounted = true

    listProjects(accessToken)
      .then((data) => {
        if (isMounted) setProjects(data)
      })
      .catch((err: Error) => {
        if (isMounted) setError(err.message)
      })

    return () => {
      isMounted = false
    }
  }, [accessToken])

  async function handleDelete(id: string) {
    if (!accessToken) return
    await deleteProject(id, accessToken)
    setProjects((prev) => (prev ? prev.filter((p) => p.id !== id) : prev))
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="text-ink/50">Loading Projects...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="text-red-600">{error}</div>
      </div>
    )
  }

  if (!projects || projects.length === 0) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="text-ink/50">No projects yet — start a topic on Home.</div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        <h1 className="mb-2 text-xl font-semibold text-ink">Projects</h1>
        {projects.map((p) => (
          <ProjectCard key={p.id} project={p} onDelete={handleDelete} />
        ))}
      </div>
    </div>
  )
}
