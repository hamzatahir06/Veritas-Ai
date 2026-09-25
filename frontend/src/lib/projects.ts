import { API_BASE, authHeader, getJson } from './api'

export type ProjectSummary = {
  id: string
  topic: string
  title: string
  status: string
  created_at: string
}

export const listProjects = (accessToken: string) =>
  getJson<ProjectSummary[]>('/api/projects', accessToken, 'Could not load projects.')

export async function deleteProject(id: string, accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: 'DELETE',
    headers: authHeader(accessToken),
  })
  if (!res.ok) throw new Error('Could not delete this research.')
}
