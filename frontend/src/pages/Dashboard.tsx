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
  const setProjectsLoading = useStore((s) => s.setProjectsLoading)
  const setProjectLoading = useStore((s) => s.setProjectLoading)
  const activeId = useStore((s) => s.activeId)
  const originalImage = useStore((s) => s.originalImage)
  const generatedImage = useStore((s) => s.generatedImage)
  const regions = useStore((s) => s.regions)
  const projectName = useStore((s) => s.projectName)
  const projectLoading = useStore((s) => s.projectLoading)
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

    setProjectsLoading(true)
    listProjects()
      .then((projects) => {
        setProjects(projects)
        setProjectsLoading(false)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load projects')
        setProjectsLoading(false)
      })
    getMaterials().then(setMaterials).catch(() => undefined)
  }, [authLoading, setProjects, setMaterials, setProjectsLoading])

  useEffect(() => {
    // Wait for auth to be ready before loading project
    if (authLoading) return

    if (id) {
      setProjectLoading(true)
      setError('') // Clear previous errors
      
      getProject(id)
        .then((p) => {
          setActive(id)
          setProjectData(p)
          resetHistory()
          setView(p.generated_image ? 'generated' : 'original')
          setProjectLoading(false)
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Failed to load project')
          setProjectLoading(false)
        })
      getProjectChat(id)
        .then((msgs) => setChat(id, msgs))
        .catch(() => undefined)
    } else {
      setActive(null)
      setProjectLoading(false)
    }
  }, [authLoading, id, setActive, setProjectData, setChat, resetHistory, setProjectLoading])

  // Auto-switch to compare view when new image is generated
  useEffect(() => {
    if (generatedImage && view === 'original') {
      setView('compare')
    }
  }, [generatedImage])

  // Preload images for smooth view switching
  useEffect(() => {
    if (originalImage) {
      const img = new Image()
      img.src = imageUrl(originalImage)
    }
    if (generatedImage) {
      const img = new Image()
      img.src = imageUrl(generatedImage)
    }
  }, [originalImage, generatedImage])

  function openProject(pid: number) {
    navigate(`/studio/${pid}`)
  }

  return (
    <div
      className={`grid h-screen overflow-hidden ${
        expanded ? 'grid-cols-1' : 'grid-cols-[auto_1fr_360px]'
      } relative`}
      style={{ backgroundColor: '#0a0a0a', color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
    >
      {/* Full-page blur loader when switching projects */}
      {projectLoading && id && (
        <div 
          className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm"
          style={{ backgroundColor: 'rgba(10, 10, 10, 0.8)' }}
        >
          <div className="text-center">
            <div 
              className="mb-4 h-12 w-12 animate-spin rounded-full border-4 mx-auto" 
              style={{ 
                borderColor: '#2a2a2a',
                borderTopColor: '#ffffff'
              }}
            />
            <p style={{ color: '#a1a1a1', fontSize: '14px', fontWeight: 500, fontFamily: 'Geist, Inter, sans-serif' }}>
              Loading project...
            </p>
          </div>
        </div>
      )}

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
          <p 
            className="p-3 text-sm"
            style={{
              borderBottom: '1px solid rgba(239, 68, 68, 0.2)',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              color: '#ff6b6b',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
          >
            {error}
          </p>
        )}
        {expanded && (
          <div 
            className="flex h-8 shrink-0 items-center justify-between px-2.5"
            style={{ 
              borderBottom: '1px solid #1a1a1a',
              backgroundColor: '#0f0f0f'
            }}
          >
            <span 
              className="text-[11px] font-semibold tracking-tight"
              style={{ 
                color: '#ffffff',
                fontFamily: 'Geist, Inter, sans-serif'
              }}
            >
              RenovaAI <span style={{ color: '#6a6a6a' }}>· Focus</span>
            </span>
            <div className="flex items-center gap-1">
              {generatedImage && (
                <div 
                  className="flex gap-0.5 p-0.5"
                  style={{ borderRadius: '8px', backgroundColor: '#1a1a1a' }}
                >
                  <button
                    onClick={() => setView('original')}
                    className="px-2 py-0.5 text-[11px] font-medium transition"
                    style={{
                      borderRadius: '6px',
                      backgroundColor: view === 'original' ? '#ffffff' : 'transparent',
                      color: view === 'original' ? '#0a0a0a' : '#8f8f8f',
                      fontFamily: 'Geist, Inter, sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      if (view !== 'original') e.currentTarget.style.color = '#ffffff'
                    }}
                    onMouseLeave={(e) => {
                      if (view !== 'original') e.currentTarget.style.color = '#8f8f8f'
                    }}
                  >
                    Original
                  </button>
                  <button
                    onClick={() => setView('generated')}
                    className="px-2 py-0.5 text-[11px] font-medium transition"
                    style={{
                      borderRadius: '6px',
                      backgroundColor: view === 'generated' ? '#ffffff' : 'transparent',
                      color: view === 'generated' ? '#0a0a0a' : '#8f8f8f',
                      fontFamily: 'Geist, Inter, sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      if (view !== 'generated') e.currentTarget.style.color = '#ffffff'
                    }}
                    onMouseLeave={(e) => {
                      if (view !== 'generated') e.currentTarget.style.color = '#8f8f8f'
                    }}
                  >
                    AI Renovated
                  </button>
                  <button
                    onClick={() => setView('compare')}
                    className="px-2 py-0.5 text-[11px] font-medium transition"
                    style={{
                      borderRadius: '6px',
                      backgroundColor: view === 'compare' ? '#ffffff' : 'transparent',
                      color: view === 'compare' ? '#0a0a0a' : '#8f8f8f',
                      fontFamily: 'Geist, Inter, sans-serif'
                    }}
                    onMouseEnter={(e) => {
                      if (view !== 'compare') e.currentTarget.style.color = '#ffffff'
                    }}
                    onMouseLeave={(e) => {
                      if (view !== 'compare') e.currentTarget.style.color = '#8f8f8f'
                    }}
                  >
                    Compare
                  </button>
                </div>
              )}
              <button
                onClick={() => setChatOpen((v) => !v)}
                className="px-2 py-0.5 text-[11px] font-medium transition"
                style={{
                  borderRadius: '6px',
                  border: '1px solid #2a2a2a',
                  color: '#ffffff',
                  backgroundColor: 'transparent',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {chatOpen ? 'Hide' : 'Chat'}
              </button>
              <button
                onClick={() => {
                  setExpanded(false)
                  setChatOpen(false)
                }}
                className="px-2 py-0.5 text-[11px] font-medium transition"
                style={{
                  borderRadius: '6px',
                  backgroundColor: '#ffffff',
                  color: '#0a0a0a',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e5e5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                Exit
              </button>
            </div>
          </div>
        )}
        {activeId && originalImage ? (
          <>
            {!expanded && (
              <header 
                className="flex h-9 shrink-0 items-center justify-between gap-2 px-2.5"
                style={{
                  borderBottom: '1px solid #1a1a1a',
                  backgroundColor: '#0f0f0f'
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  {!sidebarOpen && (
                    <button
                      onClick={() => setSidebarOpen(true)}
                      title="Show project list"
                      className="flex h-6 w-6 shrink-0 items-center justify-center transition"
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
                        width="13"
                        height="13"
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
                  <h1 
                    className="min-w-0 flex-1 truncate text-xs font-semibold"
                    style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
                  >
                    {projectName}
                  </h1>
                  {regions.length > 0 && (
                    <button
                      onClick={() => setRegionsOpen((v) => !v)}
                      title={regionsOpen ? 'Hide region list' : 'Show region list'}
                      className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium transition"
                      style={{
                        borderRadius: '6px',
                        backgroundColor: regionsOpen ? '#ffffff' : '#1a1a1a',
                        color: regionsOpen ? '#0a0a0a' : '#8f8f8f',
                        fontFamily: 'Geist, Inter, sans-serif'
                      }}
                      onMouseEnter={(e) => {
                        if (!regionsOpen) {
                          e.currentTarget.style.backgroundColor = '#2a2a2a'
                          e.currentTarget.style.color = '#ffffff'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!regionsOpen) {
                          e.currentTarget.style.backgroundColor = '#1a1a1a'
                          e.currentTarget.style.color = '#8f8f8f'
                        }
                      }}
                    >
                      {regions.length} region{regions.length === 1 ? '' : 's'}
                    </button>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {generatedImage && (
                    <div 
                      className="flex gap-0.5 p-0.5"
                      style={{ borderRadius: '8px', backgroundColor: '#1a1a1a' }}
                    >
                      <button
                        onClick={() => setView('original')}
                        className="px-2 py-0.5 text-[11px] font-medium transition"
                        style={{
                          borderRadius: '6px',
                          backgroundColor: view === 'original' ? '#ffffff' : 'transparent',
                          color: view === 'original' ? '#0a0a0a' : '#8f8f8f',
                          fontFamily: 'Geist, Inter, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          if (view !== 'original') e.currentTarget.style.color = '#ffffff'
                        }}
                        onMouseLeave={(e) => {
                          if (view !== 'original') e.currentTarget.style.color = '#8f8f8f'
                        }}
                      >
                        Original
                      </button>
                      <button
                        onClick={() => setView('generated')}
                        className="px-2 py-0.5 text-[11px] font-medium transition"
                        style={{
                          borderRadius: '6px',
                          backgroundColor: view === 'generated' ? '#ffffff' : 'transparent',
                          color: view === 'generated' ? '#0a0a0a' : '#8f8f8f',
                          fontFamily: 'Geist, Inter, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          if (view !== 'generated') e.currentTarget.style.color = '#ffffff'
                        }}
                        onMouseLeave={(e) => {
                          if (view !== 'generated') e.currentTarget.style.color = '#8f8f8f'
                        }}
                      >
                        AI Renovated
                      </button>
                      <button
                        onClick={() => setView('compare')}
                        className="px-2 py-0.5 text-[11px] font-medium transition"
                        style={{
                          borderRadius: '6px',
                          backgroundColor: view === 'compare' ? '#ffffff' : 'transparent',
                          color: view === 'compare' ? '#0a0a0a' : '#8f8f8f',
                          fontFamily: 'Geist, Inter, sans-serif'
                        }}
                        onMouseEnter={(e) => {
                          if (view !== 'compare') e.currentTarget.style.color = '#ffffff'
                        }}
                        onMouseLeave={(e) => {
                          if (view !== 'compare') e.currentTarget.style.color = '#8f8f8f'
                        }}
                      >
                        Compare
                      </button>
                    </div>
                  )}
                  <button
                    onClick={() => navigate(`/reports/${activeId}`)}
                    className="px-2 py-0.5 text-[11px] font-medium transition"
                    style={{
                      borderRadius: '6px',
                      border: '1px solid #2a2a2a',
                      color: '#ffffff',
                      backgroundColor: 'transparent',
                      fontFamily: 'Geist, Inter, sans-serif'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    Reports
                  </button>
                  <button
                    onClick={() => setExpanded(true)}
                    title="Focus mode"
                    className="px-2 py-0.5 text-[11px] font-medium transition"
                    style={{
                      borderRadius: '6px',
                      border: '1px solid #2a2a2a',
                      color: '#ffffff',
                      backgroundColor: 'transparent',
                      fontFamily: 'Geist, Inter, sans-serif'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    ⤢
                  </button>
                </div>
              </header>
            )}
            <div 
              className="flex flex-1 min-h-0 flex-col"
              style={{ backgroundColor: '#0a0a0a' }}
            >
              {view === 'generated' && generatedImage ? (
                <div key="generated-view" className="flex flex-1 items-center justify-center overflow-auto p-6">
                  <img
                    src={imageUrl(generatedImage)}
                    alt="AI-generated renovation"
                    className="max-h-full max-w-full shadow-2xl"
                    style={{
                      borderRadius: '12px',
                      border: '1px solid #1a1a1a'
                    }}
                    loading="eager"
                  />
                </div>
              ) : view === 'compare' && generatedImage ? (
                <div key="compare-view" className="flex flex-1 items-center justify-center overflow-auto p-6">
                  <div className="grid w-full max-w-7xl grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="flex flex-col">
                      <h3 
                        className="mb-3 text-sm font-semibold"
                        style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
                      >
                        Original
                      </h3>
                      <img
                        src={imageUrl(originalImage)}
                        alt="Original house"
                        className="w-full shadow-2xl"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #1a1a1a'
                        }}
                        loading="eager"
                      />
                    </div>
                    <div className="flex flex-col">
                      <h3 
                        className="mb-3 text-sm font-semibold"
                        style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
                      >
                        AI-Generated Renovation
                      </h3>
                      <img
                        src={imageUrl(generatedImage)}
                        alt="AI-generated renovation"
                        className="w-full shadow-2xl"
                        style={{
                          borderRadius: '12px',
                          border: '1px solid #1a1a1a'
                        }}
                        loading="eager"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <CanvasEditor
                  key={`canvas-${activeId}`}
                  expanded={expanded}
                  regionsOpen={regionsOpen}
                  onToggleRegions={() => setRegionsOpen((v) => !v)}
                />
              )}
            </div>
          </>
        ) : (
          <div 
            className="relative flex flex-1 items-center justify-center"
            style={{ color: '#6a6a6a' }}
          >
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                title="Show project list"
                className="absolute left-3 top-3 flex h-8 w-8 items-center justify-center transition"
                style={{
                  borderRadius: '8px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: '#0f0f0f',
                  color: '#8f8f8f'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#1a1a1a'
                  e.currentTarget.style.color = '#ffffff'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#0f0f0f'
                  e.currentTarget.style.color = '#8f8f8f'
                }}
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
            {projectLoading ? (
              <div className="text-center">
                <div 
                  className="mb-3 h-10 w-10 animate-spin rounded-full border-4 mx-auto"
                  style={{
                    borderColor: '#2a2a2a',
                    borderTopColor: '#ffffff'
                  }}
                />
                <p style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}>
                  Loading project...
                </p>
              </div>
            ) : (
              <p style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
                Select or create a project to start
              </p>
            )}
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
