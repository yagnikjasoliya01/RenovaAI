import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { deleteProject, renameProject } from '../api'
import { useStore } from '../store/useStore'
import { useAuth } from '../context/AuthContext'
import ConfirmDeleteModal from './ConfirmDeleteModal'
import MaterialRateEditor from './MaterialRateEditor'

interface Props {
  activeId: number | null
  onOpen: (id: number) => void
  onNew: () => void
  onClose: () => void
  open: boolean
}

export default function Sidebar({ activeId, onOpen, onNew, onClose, open }: Props) {
  const navigate = useNavigate()
  const { signOut, user } = useAuth()
  const projects = useStore((s) => s.projects)
  const projectsLoading = useStore((s) => s.projectsLoading)
  const upsertProjectMeta = useStore((s) => s.upsertProjectMeta)
  const removeProjectMeta = useStore((s) => s.removeProjectMeta)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; name: string } | null>(
    null,
  )
  const [deleting, setDeleting] = useState(false)
  const [showRateEditor, setShowRateEditor] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  async function commitRename(id: number) {
    const name = draft.trim()
    if (name) {
      await renameProject(id, name)
      upsertProjectMeta({
        id,
        name,
        created_at: null,
        region_count: 0,
        has_generated: false,
      })
    }
    setEditingId(null)
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteProject(deleteTarget.id)
      removeProjectMeta(deleteTarget.id)
      if (activeId === deleteTarget.id) navigate('/studio')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <aside
      className={`shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out ${
        open ? 'w-[200px]' : 'w-0'
      }`}
      style={{
        backgroundColor: '#0f0f0f',
        borderRight: open ? '1px solid #1a1a1a' : 'none'
      }}
    >
      <div className="flex h-full w-[200px] flex-col">
        <header 
          className="flex h-9 shrink-0 items-center justify-between px-2.5"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <h1 
            className="text-sm font-bold tracking-tight"
            style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            RenovaAI
          </h1>
          <button
            onClick={onClose}
            title="Collapse sidebar"
            className="flex h-6 w-6 items-center justify-center transition"
            style={{ 
              borderRadius: '6px',
              color: '#8f8f8f'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a1a'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#8f8f8f'
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m11 17-5-5 5-5" />
              <path d="m18 17-5-5 5-5" />
            </svg>
          </button>
        </header>
        <div 
          className="flex h-10 shrink-0 items-center px-1.5"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <button
            onClick={onNew}
            className="flex h-8 w-full items-center justify-center text-xs font-medium transition"
            style={{
              borderRadius: '8px',
              backgroundColor: '#ffffff',
              color: '#0a0a0a',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e5e5'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
          >
            + New Project
          </button>
        </div>
        <nav className="flex-1 overflow-x-auto overflow-y-auto px-1.5 pb-2 pt-1.5">
        {projectsLoading && (
          <div className="px-2 py-3 text-center">
            <div 
              className="mb-2 h-4 w-4 animate-spin rounded-full border-2 mx-auto"
              style={{
                borderColor: '#2a2a2a',
                borderTopColor: '#ffffff'
              }}
            />
            <p 
              className="text-[10px]"
              style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
            >
              Loading projects...
            </p>
          </div>
        )}
        {!projectsLoading && projects.length === 0 && (
          <p 
            className="px-2 py-3 text-center text-[10px]"
            style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            No projects yet
          </p>
        )}
        {!projectsLoading && projects.map((p) => {
          const active = p.id === activeId
          return (
            <div
              key={p.id}
              onClick={() => onOpen(p.id)}
              className="group mb-0.5 flex cursor-pointer items-center gap-1.5 px-2 py-1 text-xs transition"
              style={{
                borderRadius: '8px',
                backgroundColor: active ? '#ffffff' : 'transparent',
                color: active ? '#0a0a0a' : '#8f8f8f',
                fontFamily: 'Geist, Inter, sans-serif'
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = '#1a1a1a'
                  e.currentTarget.style.color = '#ffffff'
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'transparent'
                  e.currentTarget.style.color = '#8f8f8f'
                }
              }}
            >
              {editingId === p.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => commitRename(p.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename(p.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-1.5 py-0.5 text-xs outline outline-1"
                  style={{
                    borderRadius: '6px',
                    backgroundColor: '#1a1a1a',
                    color: '#ffffff',
                    outlineColor: '#2a2a2a',
                    fontFamily: 'Geist, Inter, sans-serif'
                  }}
                />
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate">{p.name}</span>
                  <button
                    title="Rename"
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingId(p.id)
                      setDraft(p.name)
                    }}
                    className="shrink-0 transition"
                    style={{
                      color: active ? '#6a6a6a' : '#6a6a6a'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = active ? '#0a0a0a' : '#ffffff'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#6a6a6a'
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                  <button
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation()
                      setDeleteTarget({ id: p.id, name: p.name })
                    }}
                    className="shrink-0 transition"
                    style={{
                      color: '#6a6a6a'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#ff6b6b'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = '#6a6a6a'
                    }}
                  >
                    <svg
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <line x1="10" y1="11" x2="10" y2="17" />
                      <line x1="14" y1="11" x2="14" y2="17" />
                    </svg>
                  </button>
                </>
              )}
            </div>
          )
        })}
      </nav>

      <div 
        className="shrink-0 p-1.5"
        style={{ borderTop: '1px solid #1a1a1a' }}
      >
        <div className="mb-1.5 flex items-center gap-1.5 px-1.5">
          <div 
            className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-medium"
            style={{
              backgroundColor: '#2a2a2a',
              color: '#ffffff',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
          >
            {user?.email?.[0].toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p 
              className="truncate text-[10px]"
              style={{ 
                color: '#8f8f8f',
                fontFamily: 'Geist, Inter, sans-serif'
              }}
            >
              {user?.user_metadata?.username || user?.email}
            </p>
          </div>
        </div>
        <div className="mb-1.5">
          <button
            onClick={() => setShowRateEditor(true)}
            className="w-full py-1 text-xs font-medium transition"
            title="Edit Material Rates"
            style={{
              borderRadius: '8px',
              backgroundColor: '#1a1a1a',
              color: '#a1a1a1',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#2a2a2a'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a1a'
              e.currentTarget.style.color = '#a1a1a1'
            }}
          >
            Material Rates
          </button>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full py-1 text-xs font-medium transition"
          style={{
            borderRadius: '8px',
            backgroundColor: '#1a1a1a',
            color: '#a1a1a1',
            fontFamily: 'Geist, Inter, sans-serif'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2a2a2a'
            e.currentTarget.style.color = '#ffffff'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#1a1a1a'
            e.currentTarget.style.color = '#a1a1a1'
          }}
        >
          Sign Out
        </button>
      </div>

      {deleteTarget && (
        <ConfirmDeleteModal
          projectName={deleteTarget.name}
          loading={deleting}
          onConfirm={confirmDelete}
          onClose={() => setDeleteTarget(null)}
        />
      )}

      {showRateEditor && (
        <MaterialRateEditor onClose={() => setShowRateEditor(false)} />
      )}
      </div>
    </aside>
  )
}
