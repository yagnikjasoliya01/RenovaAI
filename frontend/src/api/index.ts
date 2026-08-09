import { BASE, request, ApiError } from './client'
export { BASE, request, ApiError, friendlyMessage } from './client'
import type {
  ChatMessage,
  Estimate,
  Material,
  Project,
  ProjectMeta,
  Region,
  ReportResult,
} from '../types'

export const getMaterials = () => request<Material[]>('/api/materials')

export const listProjects = () => request<ProjectMeta[]>('/api/projects')

export const uploadProject = (file: File, name: string) => {
  const form = new FormData()
  form.append('file', file)
  form.append('name', name)
  return request<{ id: number; original_image: string; name: string }>(
    '/api/projects',
    { method: 'POST', body: form },
  )
}

export const getProject = (id: number) => request<Project>(`/api/projects/${id}`)

export const renameProject = (id: number, name: string) =>
  request<{ ok: boolean }>(`/api/projects/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })

export const deleteProject = (id: number) =>
  request<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' })

export interface SaveProjectBody {
  scale_ft: number | null
  scale_px: number | null
  reference_note: string | null
  texture_scale: number
  regions: Region[]
}

export const saveProject = (id: number, body: SaveProjectBody) =>
  request<{ ok: boolean }>(`/api/projects/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export const estimateProject = (
  id: number,
  body: {
    scale_ft: number | null
    scale_px: number | null
    regions: Region[]
  },
) =>
  request<Estimate>(`/api/projects/${id}/estimate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export interface ChatReply {
  reply: string
  llm_available: boolean
}

export const getProjectChat = (id: number) =>
  request<ChatMessage[]>(`/api/projects/${id}/chat`)

export const chatProject = (id: number, message: string) =>
  request<ChatReply>(`/api/projects/${id}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

export async function chatProjectStream(
  id: number,
  message: string,
  onDelta: (text: string) => void,
): Promise<void> {
  // Get auth token from Supabase
  const { supabase } = await import('../lib/supabase')
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const res = await fetch(`${BASE}/api/projects/${id}/chat/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ message }),
  })
  if (!res.ok || !res.body) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      /* non-json */
    }
    throw new ApiError(res.status, detail)
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      let evt: { type: string; text?: string }
      try {
        evt = JSON.parse(trimmed.slice(6))
      } catch {
        continue
      }
      if (evt.type === 'delta' && evt.text) onDelta(evt.text)
      else if (evt.type === 'error') throw new Error(evt.text ?? 'Chat failed')
      else if (evt.type === 'done') return
    }
  }
}

export const generateProject = (id: number, userPreferences: string = '') =>
  request<{ generated_image: string }>(`/api/projects/${id}/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_preferences: userPreferences }),
  })

export const generateReport = (id: number, body: SaveProjectBody) =>
  request<ReportResult>(`/api/projects/${id}/report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

export interface ReportMeta {
  id: number
  title: string
  created_at: string
}

export const listReports = (projectId: number) =>
  request<{ reports: ReportMeta[] }>(`/api/projects/${projectId}/reports`)

export const getReport = (projectId: number, reportId: number) =>
  request<ReportResult & { id: number; title: string; created_at: string }>(
    `/api/projects/${projectId}/reports/${reportId}`
  )

export const deleteReport = (projectId: number, reportId: number) =>
  request<{ ok: boolean }>(`/api/projects/${projectId}/reports/${reportId}`, {
    method: 'DELETE',
  })

export interface MaterialRateUpdate {
  material_id: string
  rate: number
  labor_rate: number
}

export const updateMaterialRates = (updates: MaterialRateUpdate[]) =>
  request<{ ok: boolean; updated: number }>('/api/materials/rates', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  })

export const resetMaterialRates = () =>
  request<{ ok: boolean; reset: number }>('/api/materials/rates', {
    method: 'DELETE',
  })
