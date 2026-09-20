import { API_BASE } from './api'

export type ProjectSummary = {
  id: string
  topic: string
  title: string
  status: string
  created_at: string
}

export async function listProjects(accessToken: string): Promise<ProjectSummary[]> {
  const res = await fetch(`${API_BASE}/api/projects`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Could not load projects.')
  return res.json()
}

export async function deleteProject(id: string, accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error('Could not delete this research.')
}
