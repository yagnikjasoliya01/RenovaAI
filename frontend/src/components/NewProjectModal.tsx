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
          <label 
            className="text-sm font-medium"
            style={{ color: '#a1a1a1', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            Project name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My house renovation"
            className="mt-2 w-full px-3.5 py-2.5 text-sm outline-none transition"
            style={{
              borderRadius: '10px',
              border: '1px solid #2a2a2a',
              backgroundColor: '#1a1a1a',
              color: '#ffffff',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#6366f1'
              e.currentTarget.style.boxShadow = '0 0 0 2px rgba(99, 102, 241, 0.2)'
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a'
              e.currentTarget.style.boxShadow = 'none'
            }}
          />
        </div>
        <div>
          <label 
            className="text-sm font-medium"
            style={{ color: '#a1a1a1', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            House photo
          </label>
          <label 
            className="mt-2 block cursor-pointer p-4 text-center text-sm transition"
            style={{
              borderRadius: '10px',
              border: '2px dashed #2a2a2a',
              color: '#6a6a6a',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#6a6a6a'
              e.currentTarget.style.color = '#8f8f8f'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#2a2a2a'
              e.currentTarget.style.color = '#6a6a6a'
            }}
          >
            {file ? (
              <span 
                className="font-medium block truncate px-2"
                style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
                title={file.name}
              >
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
        {error && (
          <p 
            className="text-sm"
            style={{ color: '#ff6b6b', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            {error}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-medium transition"
            style={{
              borderRadius: '10px',
              border: '1px solid #2a2a2a',
              color: '#ffffff',
              backgroundColor: 'transparent',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!file || loading}
            className="flex-1 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              borderRadius: '10px',
              backgroundColor: (!file || loading) ? '#2a2a2a' : '#ffffff',
              color: (!file || loading) ? '#6a6a6a' : '#0a0a0a',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
            onMouseEnter={(e) => {
              if (file && !loading) {
                e.currentTarget.style.backgroundColor = '#e5e5e5'
              }
            }}
            onMouseLeave={(e) => {
              if (file && !loading) {
                e.currentTarget.style.backgroundColor = '#ffffff'
              }
            }}
          >
            {loading ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
