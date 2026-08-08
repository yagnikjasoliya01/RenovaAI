import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { listReports, deleteReport, type ReportMeta } from '../api'

export default function ReportsList() {
  const { projectId } = useParams()
  const id = projectId ? Number(projectId) : null
  const navigate = useNavigate()

  const [reports, setReports] = useState<ReportMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    loadReports()
  }, [id])

  async function loadReports() {
    if (!id) return
    setLoading(true)
    try {
      const res = await listReports(id)
      setReports(res.reports)
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(reportId: number) {
    if (!id) return
    if (!confirm('Delete this report? This cannot be undone.')) return

    try {
      await deleteReport(id, reportId)
      setReports((prev) => prev.filter((r) => r.id !== reportId))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete report')
    }
  }

  function viewReport(reportId: number) {
    navigate(`/report/${id}/${reportId}`)
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/90 px-4 backdrop-blur">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to={`/studio/${id}`}
            className="flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-zinc-100"
          >
            <span aria-hidden>←</span> Studio
          </Link>
          <span className="h-4 w-px bg-zinc-800" />
          <h1 className="truncate text-sm font-semibold text-zinc-100">
            All Reports
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-4xl p-6">
        {loading && (
          <div className="text-center text-zinc-400">Loading reports...</div>
        )}

        {error && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
            {error}
          </div>
        )}

        {!loading && !error && reports.length === 0 && (
          <div className="text-center">
            <p className="text-zinc-400">No reports generated yet.</p>
            <p className="mt-2 text-sm text-zinc-500">
              Go to Studio and use chat to generate a report.
            </p>
            <Link
              to={`/studio/${id}`}
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              Go to Studio
            </Link>
          </div>
        )}

        {!loading && reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 transition hover:bg-zinc-900"
              >
                <div className="flex-1">
                  <h3 className="font-medium text-zinc-100">{report.title}</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    Generated on {new Date(report.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => viewReport(report.id)}
                    className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                  >
                    View
                  </button>
                  <button
                    onClick={() => handleDelete(report.id)}
                    className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
