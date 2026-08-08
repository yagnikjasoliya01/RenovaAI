import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getMaterials, getProject, getProjectChat, listProjects } from '../api'
import { imageUrl } from '../api/client'
import { useStore } from '../store/useStore'
import { useAuth } from '../context/AuthContext'
import Sidebar from '../components/Sidebar'
import ChatPanel from '../components/ChatPanel'
import NewProjectModal from '../components/NewProjectModal'
import CanvasEditor from '../components/CanvasEditor'
import RightPanel from '../components/RightPanel'

export default function Dashboard() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const id = projectId ? Number(projectId) : null
  const { loading: authLoading } = useAuth()

  const setProjects = useStore((s) => s.setProjects)
  const setActive = useStore((s) => s.setActive)
  const setProjectData = useStore((s) => s.setProjectData)
  const setMaterials = useStore((s) => s.setMaterials)
  const setChat = useStore((s) => s.setChat)
  const resetHistory = useStore((s) => s.resetHistory)
  const activeId = useStore((s) => s.activeId)
  const originalImage = useStore((s) => s.originalImage)
  const generatedImage = useStore((s) => s.generatedImage)
  const regions = useStore((s) => s.regions)
  const projectName = useStore((s) => s.projectName)
  const [error, setError] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [view, setView] = useState<'original' | 'generated' | 'compare'>('original')
  const [expanded, setExpanded] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [regionsOpen, setRegionsOpen] = useState(
    () => typeof window !== 'undefined' && window.innerWidth >= 1440,
  )

  useEffect(() => {
    // Wait for auth to be ready before making API calls
    if (authLoading) return

    listProjects()
      .then(setProjects)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Failed to load projects'),
      )
    getMaterials().then(setMaterials).catch(() => undefined)
  }, [authLoading, setProjects, setMaterials])

  useEffect(() => {
    // Wait for auth to be ready before loading project
    if (authLoading) return

    if (id) {
      getProject(id)
        .then((p) => {
          setActive(id)
          setProjectData(p)
          resetHistory()
          setView(p.generated_image ? 'generated' : 'original')
        })
        .catch((err: unknown) =>
          setError(err instanceof Error ? err.message : 'Failed to load project'),
        )
      getProjectChat(id)
        .then((msgs) => setChat(id, msgs))
        .catch(() => undefined)
    } else {
      setActive(null)
    }
  }, [authLoading, id, setActive, setProjectData, setChat, resetHistory])

  // Auto-switch to compare view when new image is generated
  useEffect(() => {
    if (generatedImage && view === 'original') {
      setView('compare')
    }
  }, [generatedImage])

  function openProject(pid: number) {
    navigate(`/studio/${pid}`)
  }

  return (
    <div
      className={`grid h-screen overflow-hidden ${
        expanded ? 'grid-cols-1' : 'grid-cols-[auto_1fr_360px]'
      } bg-zinc-950 text-zinc-100`}
    >
      {!expanded && (
        <Sidebar
          activeId={activeId}
          onOpen={openProject}
          onNew={() => setShowNew(true)}
          onClose={() => setSidebarOpen(false)}
          open={sidebarOpen}
        />
      )}
      {showNew && <NewProjectModal onClose={() => setShowNew(false)} />}

      <main className="flex min-w-0 flex-col overflow-hidden">
        {error && (
          <p className="border-b border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
            {error}
          </p>
        )}
        {expanded && (
          <div className="flex h-9 shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-900 px-3">
            <span className="text-xs font-semibold tracking-tight text-zinc-200">
              RenovaAI <span className="text-zinc-500">· Focus</span>
            </span>
            <div className="flex items-center gap-1.5">
              {generatedImage && (
                <div className="flex gap-0.5 rounded-md bg-zinc-800 p-0.5">
                  <button
                    onClick={() => setView('original')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      view === 'original'
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => setView('generated')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      view === 'generated'
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    AI Renovated
                  </button>
                  <button
                    onClick={() => setView('compare')}
                    className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                      view === 'compare'
                        ? 'bg-zinc-100 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Compare
                  </button>
                </div>
              )}
              <button
                onClick={() => setChatOpen((v) => !v)}
                className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
              >
                {chatOpen ? 'Hide chat' : 'Chat'}
              </button>
              <button
                onClick={() => {
                  setExpanded(false)
                  setChatOpen(false)
                }}
                className="rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-950 transition hover:bg-zinc-300"
              >
                Exit focus
              </button>
            </div>
          </div>
        )}
        {activeId && originalImage ? (
          <>
            {!expanded && (
              <header className="flex h-9 shrink-0 items-center justify-between gap-3 border-b border-zinc-800 bg-zinc-900 px-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  {!sidebarOpen && (
                    <button
                      onClick={() => setSidebarOpen(true)}
                      title="Show project list"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M4 6h16" />
                        <path d="M4 12h16" />
                        <path d="M4 18h16" />
                      </svg>
                    </button>
                  )}
                  <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
                    {projectName}
                  </h1>
                  {regions.length > 0 && (
                    <button
                      onClick={() => setRegionsOpen((v) => !v)}
                      title={regionsOpen ? 'Hide region list' : 'Show region list'}
                      className={`shrink-0 rounded-md px-2 py-1 text-[11px] font-medium transition ${
                        regionsOpen
                          ? 'bg-zinc-100 text-zinc-950'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
                      }`}
                    >
                      {regions.length} region{regions.length === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {generatedImage && (
                    <div className="flex gap-0.5 rounded-md bg-zinc-800 p-0.5">
                      <button
                        onClick={() => setView('original')}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                          view === 'original'
                            ? 'bg-zinc-100 text-zinc-950'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => setView('generated')}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                          view === 'generated'
                            ? 'bg-zinc-100 text-zinc-950'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        AI Renovated
                      </button>
                      <button
                        onClick={() => setView('compare')}
                        className={`rounded px-2.5 py-1 text-xs font-medium transition ${
                          view === 'compare'
                            ? 'bg-zinc-100 text-zinc-950'
                            : 'text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        Compare
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/reports/${activeId}`)}
                    className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                  >
                    Reports
                  </button>
                  <button
                    onClick={() => setExpanded(true)}
                    title="Focus mode"
                    className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs font-medium text-zinc-200 transition hover:bg-zinc-800"
                  >
                    ⤢
                  </button>
                </div>
              </header>
            )}
            <div className="flex flex-1 min-h-0 flex-col bg-zinc-900/40">
              {view === 'generated' && generatedImage ? (
                <div className="flex flex-1 items-center justify-center overflow-auto p-6">
                  <img
                    src={imageUrl(generatedImage)}
                    alt="AI-generated renovation"
                    className="max-h-full max-w-full rounded-xl border border-zinc-800 shadow-2xl"
                  />
                </div>
              ) : view === 'compare' && generatedImage ? (
                <div className="flex flex-1 items-center justify-center overflow-auto p-6">
                  <div className="grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="flex flex-col">
                      <h3 className="mb-3 text-sm font-semibold text-zinc-400">Original</h3>
                      <img
                        src={imageUrl(originalImage)}
                        alt="Original house"
                        className="w-full rounded-xl border border-zinc-800 shadow-2xl"
                      />
                    </div>
                    <div className="flex flex-col">
                      <h3 className="mb-3 text-sm font-semibold text-zinc-400">AI-Generated Renovation</h3>
                      <img
                        src={imageUrl(generatedImage)}
                        alt="AI-generated renovation"
                        className="w-full rounded-xl border border-zinc-800 shadow-2xl"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <CanvasEditor
                  expanded={expanded}
                  regionsOpen={regionsOpen}
                  onToggleRegions={() => setRegionsOpen((v) => !v)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="relative flex flex-1 items-center justify-center text-zinc-600">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Show project list"
                className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <path d="M4 6h16" />
                  <path d="M4 12h16" />
                  <path d="M4 18h16" />
                </svg>
              </button>
            )}
            {id ? 'Loading project...' : 'Select or create a project to start'}
          </div>
        )}
      </main>

      {!expanded && <RightPanel />}

      {expanded && chatOpen && (
        <div className="fixed right-0 top-0 z-40 flex h-full w-[380px] flex-col border-l border-zinc-800 bg-zinc-900/95 shadow-2xl backdrop-blur">
          <ChatPanel onClose={() => setChatOpen(false)} />
        </div>
      )}
    </div>
  )
}
