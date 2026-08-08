import { useEffect, useState, useRef } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getReport, getProject } from '../api'
import type { Project } from '../types'

export default function Report() {
  const { projectId, reportId } = useParams()
  const id = projectId ? Number(projectId) : null
  const rId = reportId ? Number(reportId) : null

  const [project, setProject] = useState<Project | null>(null)
  const [reportHtml, setReportHtml] = useState<string>('')
  const [reportTitle, setReportTitle] = useState<string>('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!id || !rId) return
    let cancelled = false
    setLoading(true)

    // Get project info and report
    Promise.all([getProject(id), getReport(id, rId)])
      .then(([p, r]) => {
        if (!cancelled) {
          setProject(p)
          setReportHtml(r.html)
          setReportTitle(r.title || 'Report')
          setError('')
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load report'
          setError(message)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id, rId])

  // Load HTML into iframe when reportHtml changes
  useEffect(() => {
    if (reportHtml && iframeRef.current) {
      const iframe = iframeRef.current
      const doc = iframe.contentDocument || iframe.contentWindow?.document
      if (doc) {
        doc.open()
        doc.write(reportHtml)
        doc.close()
      }
    }
  }, [reportHtml])

  function download() {
    if (!reportHtml || !project) return
    const blob = new Blob([reportHtml], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `renovai-report-${project.name.replace(/[^\w-]+/g, '-').toLowerCase() || 'project'}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur print:hidden">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={`/reports/${id}`}
            className="flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            <span aria-hidden>←</span> All Reports
          </Link>
          <span className="h-4 w-px bg-zinc-800" />
          <h1 className="truncate text-sm font-semibold text-zinc-100">
            {reportTitle || 'Loading…'}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={download}
            disabled={!reportHtml}
            className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Download .html
          </button>
          <button
            onClick={() => window.print()}
            disabled={!reportHtml}
            className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-950 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Print / Save PDF
          </button>
        </div>
      </header>

      <main className="p-4 md:p-8">
        {loading && (
          <p className="text-center text-sm text-zinc-500">Loading report…</p>
        )}

        {error && !loading && (
          <div className="mx-auto max-w-lg rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
            <p className="text-sm text-red-400">{error}</p>
            <Link
              to={`/reports/${id}`}
              className="mt-4 inline-block text-sm text-zinc-300 underline underline-offset-4 hover:text-zinc-100"
            >
              Back to reports list
            </Link>
          </div>
        )}

        {reportHtml && !loading && (
          <div className="mx-auto max-w-7xl">
            <iframe
              ref={iframeRef}
              title="Report Preview"
              className="w-full border-0"
              style={{ minHeight: '100vh', height: '100%' }}
              sandbox="allow-same-origin"
            />
          </div>
        )}
      </main>
    </div>
  )
}
