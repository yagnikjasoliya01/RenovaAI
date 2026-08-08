import { supabase } from '../lib/supabase'

export const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  try {
    // Get auth token from Supabase
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const headers = new Headers(init?.headers)
    if (session?.access_token) {
      headers.set('Authorization', `Bearer ${session.access_token}`)
    } else {
      console.warn('No auth session found for request to:', path)
    }

    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers,
    })

    if (!res.ok) {
      let detail = res.statusText
      try {
        const body = await res.json()
        detail = Array.isArray(body.detail)
          ? body.detail.map((d: { msg: string }) => d.msg).join('; ')
          : body.detail ?? detail
      } catch {
        /* non-json body */
      }
      console.error(`API Error [${res.status}] ${path}:`, detail)
      throw new ApiError(res.status, detail)
    }
    return res.json() as Promise<T>
  } catch (error) {
    if (error instanceof ApiError) throw error
    console.error('Network error for', path, ':', error)
    throw new ApiError(0, 'Network error: ' + (error as Error).message)
  }
}

export function imageUrl(path: string): string {
  // If path is already a full URL (Supabase Storage), return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }
  
  // Otherwise, prepend backend base URL (local development)
  const normalized = path.replace(/\\/g, '/')
  return `${BASE}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
}
