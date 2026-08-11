import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  chatProjectStream,
  generateProject,
  generateReport,
  getProjectChat,
  friendlyMessage,
  ApiError,
  type SaveProjectBody,
} from '../api'
import { useStore } from '../store/useStore'
import Markdown from './Markdown'

interface Props {
  onClose?: () => void
  embedded?: boolean
}

export default function ChatPanel({ onClose, embedded = false }: Props) {
  const activeId = useStore((s) => s.activeId)
  const chatByProject = useStore((s) => s.chatByProject)
  const chat = activeId ? (chatByProject[activeId] ?? []) : []
  const chatPush = useStore((s) => s.chatPush)
  const setChat = useStore((s) => s.setChat)
  const setGeneratedImage = useStore((s) => s.setGeneratedImage)
  const regions = useStore((s) => s.regions)
  const scaleFt = useStore((s) => s.scaleFt)
  const scalePx = useStore((s) => s.scalePx)

  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState('')
  const [generating, setGenerating] = useState(false)
  const [reporting, setReporting] = useState(false)
  const [reportHtml, setReportHtml] = useState<Record<number, string>>({})
  const [designPreferences, setDesignPreferences] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const hasScale = !!scaleFt && !!scalePx
  const reportReady = !!activeId && !!reportHtml[activeId]
  const canGenerate = activeId && regions.length > 0
  const canReport = activeId && hasScale && regions.length > 0
  
  // Word count for preferences
  const wordCount = designPreferences.trim().split(/\s+/).filter(Boolean).length
  const maxWords = 150

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length, streamText])

  function reportBody(): SaveProjectBody {
    return {
      scale_ft: scaleFt,
      scale_px: scalePx,
      reference_note: null,
      texture_scale: 1,
      regions: regions.map((r) => ({
        label: r.label,
        points: r.points,
        material_id: r.material_id ?? null,
      })),
    }
  }

  function downloadReport() {
    if (!activeId) return
    const html = reportHtml[activeId]
    if (!html) return
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'renovai-report.html'
    a.click()
    URL.revokeObjectURL(url)
  }

  function errStatus(err: unknown): number {
    return err instanceof ApiError ? err.status : -1
  }

  function errDetail(err: unknown): string {
    return err instanceof Error ? err.message : ''
  }

  async function send(e: FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || !activeId || streaming) return
    chatPush(activeId, { role: 'user', content: text })
    setInput('')
    setStreaming(true)
    setStreamText('')
    let acc = ''
    try {
      await chatProjectStream(activeId, text, (piece) => {
        acc += piece
        setStreamText(acc)
      })
      chatPush(activeId, { role: 'assistant', content: acc })
    } catch (err) {
      chatPush(activeId, {
        role: 'assistant',
        content: acc || friendlyMessage(errStatus(err), errDetail(err)),
      })
    } finally {
      setStreaming(false)
      setStreamText('')
    }
  }

  async function generate() {
    if (!canGenerate || generating) return
    
    setGenerating(true)
    try {
      const res = await generateProject(activeId!, designPreferences)
      setGeneratedImage(res.generated_image)
      
      const msgs = await getProjectChat(activeId!)
      setChat(activeId!, msgs)
      
      setDesignPreferences('')
    } catch (err) {
      chatPush(activeId!, {
        role: 'assistant',
        content: friendlyMessage(errStatus(err), errDetail(err)),
      })
    } finally {
      setGenerating(false)
    }
  }

  async function report() {
    if (!canReport || reporting) return
    
    setReporting(true)
    try {
      const res = await generateReport(activeId!, reportBody())
      setReportHtml((m) => ({ ...m, [activeId!]: res.html }))
      
      const msgs = await getProjectChat(activeId!)
      setChat(activeId!, msgs)
    } catch (err) {
      chatPush(activeId!, {
        role: 'assistant',
        content: friendlyMessage(errStatus(err), errDetail(err)),
      })
    } finally {
      setReporting(false)
    }
  }

  return (
    <aside
      className={`flex min-h-0 min-w-0 flex-1 flex-col ${
        embedded ? '' : ''
      }`}
      style={{
        backgroundColor: '#0a0a0a',
        borderLeft: embedded ? 'none' : '1px solid #1a1a1a'
      }}
    >
      {/* Header */}
      {!embedded && (
        <header 
          className="flex h-11 shrink-0 items-center justify-between px-3"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <div className="flex items-center gap-2">
            <div 
              className="flex h-7 w-7 items-center justify-center text-xs font-semibold"
              style={{
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                color: '#ffffff',
                fontFamily: 'Geist, Inter, sans-serif'
              }}
            >
              AI
            </div>
            <div>
              <h2 
                className="text-xs font-semibold"
                style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                RenovaAI Assistant
              </h2>
              <p 
                className="text-[10px]"
                style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                {streaming ? 'Typing...' : 'Online'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 transition"
              style={{ 
                borderRadius: '6px',
                color: '#6a6a6a'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#1a1a1a'
                e.currentTarget.style.color = '#ffffff'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#6a6a6a'
              }}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </header>
      )}

      {/* Messages */}
      <div 
        className="min-h-0 flex-1 overflow-y-auto"
        style={{ backgroundColor: '#0a0a0a' }}
      >
        {!activeId && (
          <div className="flex h-full items-center justify-center px-4">
            <p 
              className="text-center text-sm"
              style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
            >
              Open a project to start chatting
            </p>
          </div>
        )}

        {activeId && chat.length === 0 && !streaming && (
          <div className="mx-auto max-w-2xl space-y-4 px-3 py-6">
            <div className="text-center">
              <div 
                className="mx-auto mb-3 flex h-12 w-12 items-center justify-center"
                style={{
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)'
                }}
              >
                <span className="text-xl text-white">✨</span>
              </div>
              <h3 
                className="text-base font-semibold"
                style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                Welcome to RenovaAI
              </h3>
              <p 
                className="mt-1 text-xs"
                style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                Your AI assistant for exterior home renovation
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div 
                className="p-2.5"
                style={{
                  borderRadius: '10px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: '#0f0f0f'
                }}
              >
                <div className="mb-1 text-lg">💬</div>
                <h4 
                  className="mb-0.5 text-xs font-medium"
                  style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  Ask Questions
                </h4>
                <p 
                  className="text-[10px]"
                  style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  Get advice on materials, colors & maintenance
                </p>
              </div>
              
              <div 
                className="p-2.5"
                style={{
                  borderRadius: '10px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: '#0f0f0f'
                }}
              >
                <div className="mb-1 text-lg">🎨</div>
                <h4 
                  className="mb-0.5 text-xs font-medium"
                  style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  Generate Designs
                </h4>
                <p 
                  className="text-[10px]"
                  style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  AI-powered renovation visualizations
                </p>
              </div>
              
              <div 
                className="p-2.5"
                style={{
                  borderRadius: '10px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: '#0f0f0f'
                }}
              >
                <div className="mb-1 text-lg">✏️</div>
                <h4 
                  className="mb-0.5 text-xs font-medium"
                  style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  Design Preferences
                </h4>
                <p 
                  className="text-[10px]"
                  style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  Add your vision and style preferences
                </p>
              </div>
              
              <div 
                className="p-2.5"
                style={{
                  borderRadius: '10px',
                  border: '1px solid #1a1a1a',
                  backgroundColor: '#0f0f0f'
                }}
              >
                <div className="mb-1 text-lg">📊</div>
                <h4 
                  className="mb-0.5 text-xs font-medium"
                  style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  Cost Reports
                </h4>
                <p 
                  className="text-[10px]"
                  style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  Detailed estimates with quantities
                </p>
              </div>
            </div>

            <div 
              className="p-2.5"
              style={{
                borderRadius: '10px',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                backgroundColor: 'rgba(99, 102, 241, 0.1)'
              }}
            >
              <p 
                className="mb-1 text-[10px] font-medium"
                style={{ color: '#a5b4fc', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                Try asking:
              </p>
              <div 
                className="space-y-0.5 text-[10px]"
                style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                <p>• "What paint is best for rainy weather?"</p>
                <p>• "Compare stone cladding vs tiles"</p>
                <p>• "How to maintain exterior paint?"</p>
              </div>
            </div>
          </div>
        )}

        <div className="mx-auto max-w-3xl space-y-3 px-3 py-3">
          {chat.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div 
                  className="max-w-[80%] px-3 py-2 text-xs leading-relaxed"
                  style={{
                    borderRadius: '12px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    fontFamily: 'Geist, Inter, sans-serif'
                  }}
                >
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <div 
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-semibold"
                  style={{
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: '#ffffff',
                    fontFamily: 'Geist, Inter, sans-serif'
                  }}
                >
                  AI
                </div>
                <div 
                  className="min-w-0 flex-1 space-y-1 pt-0.5 text-xs"
                  style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  <Markdown text={m.content} />
                </div>
              </div>
            )
          )}

          {(streaming || generating || reporting) && (
            <div className="flex gap-2">
              <div 
                className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[10px] font-semibold"
                style={{
                  borderRadius: '8px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                  color: '#ffffff',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
              >
                AI
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                {streamText ? (
                  <div className="space-y-1 text-xs">
                    <Markdown text={streamText} />
                    <span className="inline-block h-3 w-0.5 animate-pulse bg-zinc-400" />
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <div className="flex gap-1">
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:0ms]" />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:150ms]" />
                      <div className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-400 [animation-delay:300ms]" />
                    </div>
                    {generating && 'Generating...'}
                    {reporting && 'Creating report...'}
                    {streaming && 'Thinking...'}
                  </div>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input Area */}
      {activeId && (
        <div 
          className="shrink-0 p-3"
          style={{
            borderTop: '1px solid #1a1a1a',
            backgroundColor: '#0a0a0a'
          }}
        >
          <div className="mx-auto max-w-3xl space-y-2">
            {/* Design Preferences - FIRST */}
            {canGenerate && (
              <div 
                className="p-2"
                style={{
                  borderRadius: '10px',
                  border: '1px solid #2a2a2a',
                  backgroundColor: '#0f0f0f'
                }}
              >
                <label 
                  className="mb-1 block text-[11px] font-medium"
                  style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  ✨ Design Preferences (Optional)
                </label>
                <textarea
                  value={designPreferences}
                  onChange={(e) => {
                    const words = e.target.value.trim().split(/\s+/).filter(Boolean)
                    if (words.length <= maxWords) {
                      setDesignPreferences(e.target.value)
                    }
                  }}
                  placeholder="e.g., Modern minimalist, warm tones, add plants..."
                  className="w-full resize-none px-2 py-1.5 text-xs outline-none transition"
                  style={{
                    borderRadius: '8px',
                    border: '1px solid #2a2a2a',
                    backgroundColor: '#0a0a0a',
                    color: '#ffffff',
                    fontFamily: 'Geist, Inter, sans-serif'
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                  onBlur={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
                  rows={2}
                />
                <p 
                  className="mt-1 text-right text-[10px]"
                  style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  {wordCount}/{maxWords} words
                </p>
              </div>
            )}

            {/* Action Buttons - SECOND */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={generate}
                disabled={!canGenerate || generating || streaming}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderRadius: '8px',
                  backgroundColor: (!canGenerate || generating || streaming) ? '#2a2a2a' : '#6366f1',
                  color: '#ffffff',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
                onMouseEnter={(e) => {
                  if (canGenerate && !generating && !streaming) {
                    e.currentTarget.style.backgroundColor = '#4f46e5'
                  }
                }}
                onMouseLeave={(e) => {
                  if (canGenerate && !generating && !streaming) {
                    e.currentTarget.style.backgroundColor = '#6366f1'
                  }
                }}
              >
                {generating ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Generate Image
                  </>
                )}
              </button>

              <button
                onClick={report}
                disabled={!canReport || reporting || streaming}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderRadius: '8px',
                  border: '1px solid #2a2a2a',
                  backgroundColor: '#1a1a1a',
                  color: (!canReport || reporting || streaming) ? '#6a6a6a' : '#ffffff',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
                onMouseEnter={(e) => {
                  if (canReport && !reporting && !streaming) {
                    e.currentTarget.style.backgroundColor = '#2a2a2a'
                  }
                }}
                onMouseLeave={(e) => {
                  if (canReport && !reporting && !streaming) {
                    e.currentTarget.style.backgroundColor = '#1a1a1a'
                  }
                }}
              >
                {reporting ? (
                  <>
                    <div 
                      className="h-3 w-3 animate-spin rounded-full border-2"
                      style={{ borderColor: '#8f8f8f', borderTopColor: 'transparent' }}
                    />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Cost Report
                  </>
                )}
              </button>

              {reportReady && (
                <button
                  onClick={downloadReport}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition"
                  style={{
                    borderRadius: '8px',
                    backgroundColor: '#10b981',
                    color: '#ffffff',
                    fontFamily: 'Geist, Inter, sans-serif'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download
                </button>
              )}
            </div>

            {/* Chat Input - THIRD */}
            <form onSubmit={send} className="flex gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about materials, costs, or design advice..."
                disabled={streaming}
                className="h-9 flex-1 px-3 text-sm outline-none transition disabled:opacity-50"
                style={{
                  borderRadius: '10px',
                  border: '1px solid #2a2a2a',
                  backgroundColor: '#0f0f0f',
                  color: '#ffffff',
                  fontFamily: 'Geist, Inter, sans-serif'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
                onBlur={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="flex h-9 w-9 items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-40"
                style={{
                  borderRadius: '10px',
                  backgroundColor: (streaming || !input.trim()) ? '#2a2a2a' : '#6366f1',
                  color: '#ffffff'
                }}
                onMouseEnter={(e) => {
                  if (!streaming && input.trim()) {
                    e.currentTarget.style.backgroundColor = '#4f46e5'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!streaming && input.trim()) {
                    e.currentTarget.style.backgroundColor = '#6366f1'
                  }
                }}
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>

            {/* Hints */}
            {!canGenerate && (
              <p className="text-center text-[10px] text-zinc-600">
                💡 Draw regions and select materials to enable generation
              </p>
            )}
            {canGenerate && !canReport && (
              <p className="text-center text-[10px] text-zinc-600">
                💡 Set reference measurement for cost reports
              </p>
            )}
          </div>
        </div>
      )}
    </aside>
  )
}
