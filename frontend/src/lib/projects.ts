import { API_BASE, authHeader, fail } from './api'

export type ProjectSummary = {
  id: string
  topic: string
  title: string
  status: string
  created_at: string
}

export async function deleteProject(id: string, accessToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/projects/${id}`, {
    method: 'DELETE',
    headers: authHeader(accessToken),
  })
  if (!res.ok) await fail(res, 'Could not delete this research.')
}
