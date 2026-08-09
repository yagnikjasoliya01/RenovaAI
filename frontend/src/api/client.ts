import { supabase } from '../lib/supabase'

export const BASE = import.meta.env.VITE_API_URL ?? ''

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export function friendlyMessage(status: number, detail?: string): string {
  if (status === 0) {
    return 'Please check your internet connection and try again.'
  }
  if (status === 401) {
    return 'Your session has expired. Please log in again.'
  }
  if (status === 422) {
    return 'Something was missing in your request. Please try again.'
  }
  if (status === 502 || status === 503) {
    return 'The service is temporarily unavailable. Please try again in a few minutes.'
  }
  if (status === 500) {
    return 'Something went wrong on our side. Please try again.'
  }
  if (detail && detail.trim()) {
    return detail
  }
  return 'Something went wrong. Please try again.'
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
    // Supabase render endpoint re-encodes to WebP (~80% quality) unless told
    // otherwise. Force original format & quality so images aren't degraded.
    if (
      path.includes('/storage/v1/render/image/') &&
      !path.includes('format=') &&
      !path.includes('quality=')
    ) {
      const sep = path.includes('?') ? '&' : '?'
      return `${path}${sep}format=origin&quality=100`
    }
    return path
  }
  
  // Otherwise, prepend backend base URL (local development)
  const normalized = path.replace(/\\/g, '/')
  return `${BASE}${normalized.startsWith('/') ? normalized : `/${normalized}`}`
}
