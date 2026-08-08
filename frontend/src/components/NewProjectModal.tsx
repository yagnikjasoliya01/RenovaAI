import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadProject } from '../api'
import { useStore } from '../store/useStore'
import Modal from './Modal'

interface Props {
  onClose: () => void
}

export default function NewProjectModal({ onClose }: Props) {
  const navigate = useNavigate()
  const upsertProjectMeta = useStore((s) => s.upsertProjectMeta)
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const project = await uploadProject(file, name.trim() || 'Untitled Project')
      upsertProjectMeta({
        id: project.id,
        name: project.name,
        created_at: null,
        region_count: 0,
        has_generated: false,
      })
      onClose()
      navigate(`/studio/${project.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="New Project" onClose={onClose}>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium text-zinc-300">
            Project name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My house renovation"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
          />
        </div>
        <div>
          <label className="text-sm font-medium text-zinc-300">House photo</label>
          <label className="mt-1 block cursor-pointer rounded-xl border-2 border-dashed border-zinc-700 p-4 text-center text-sm text-zinc-500 transition hover:border-zinc-500 hover:text-zinc-400">
            {file ? (
              <span className="font-medium text-zinc-200 block truncate px-2" title={file.name}>
                {file.name}
              </span>
            ) : (
              'Click to select an image'
            )}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!file || loading}
            className="flex-1 rounded-xl bg-zinc-100 py-2.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
