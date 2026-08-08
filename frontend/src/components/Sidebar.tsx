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
        open ? 'w-[220px] border-r border-zinc-800' : 'w-0'
      } bg-zinc-900/70`}
    >
      <div className="flex h-full w-[220px] flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
          <h1 className="text-sm font-bold tracking-tight text-zinc-100">
            RenovaAI
          </h1>
          <button
            onClick={onClose}
            title="Collapse sidebar"
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            <svg
              width="14"
              height="14"
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
        <div className="shrink-0 p-2">
          <button
            onClick={onNew}
            className="w-full rounded-lg bg-zinc-100 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300"
          >
            + New Project
          </button>
        </div>
        <nav className="flex-1 overflow-x-auto overflow-y-auto px-1.5 pb-3">
        {projects.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-zinc-500">
            No projects yet
          </p>
        )}
        {projects.map((p) => {
          const active = p.id === activeId
          return (
            <div
              key={p.id}
              onClick={() => onOpen(p.id)}
              className={`group mb-0.5 flex cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-sm ${
                active
                  ? 'bg-zinc-100 text-zinc-950'
                  : 'text-zinc-400 hover:bg-zinc-800/70 hover:text-zinc-100'
              }`}
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
                  className="w-full rounded bg-zinc-800 px-1.5 py-0.5 text-sm text-zinc-100 outline outline-1 outline-zinc-600"
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
                    className={`shrink-0 opacity-0 transition group-hover:opacity-100 ${
                      active
                        ? 'text-zinc-500 hover:text-zinc-900'
                        : 'text-zinc-500 hover:text-zinc-100'
                    }`}
                  >
                    <svg
                      width="13"
                      height="13"
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
                    className={`shrink-0 opacity-0 transition group-hover:opacity-100 ${
                      active
                        ? 'text-zinc-500 hover:text-red-600'
                        : 'text-zinc-500 hover:text-red-400'
                    }`}
                  >
                    <svg
                      width="13"
                      height="13"
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

      <div className="shrink-0 border-t border-zinc-800 p-2">
        <div className="mb-2 flex items-center gap-2 px-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-700 text-xs font-medium text-zinc-100">
            {user?.email?.[0].toUpperCase() || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs text-zinc-400">
              {user?.user_metadata?.username || user?.email}
            </p>
          </div>
        </div>
        <div className="mb-2">
          <button
            onClick={() => setShowRateEditor(true)}
            className="w-full rounded-lg bg-zinc-800 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
            title="Edit Material Rates"
          >
            💰 Material Rates
          </button>
        </div>
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg bg-zinc-800 py-1.5 text-sm font-medium text-zinc-300 transition hover:bg-zinc-700 hover:text-zinc-100"
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
