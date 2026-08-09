import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  chatProjectStream,
  generateProject,
  generateReport,
  getProjectChat,
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
        content:
          acc ||
          (err instanceof Error ? err.message : 'Chat failed. Try again.'),
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
        content: `❌ Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
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
        content: `❌ Failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      })
    } finally {
      setReporting(false)
    }
  }

  return (
    <aside
      className={`flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-900 ${
        embedded ? '' : 'border-l border-zinc-800'
      }`}
    >
      {/* Header */}
      {!embedded && (
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-zinc-800 px-3">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-semibold text-white">
              AI
            </div>
            <div>
              <h2 className="text-xs font-semibold text-zinc-100">
                RenovaAI Assistant
              </h2>
              <p className="text-[10px] text-zinc-500">
                {streaming ? 'Typing...' : 'Online'}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded p-1 text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </header>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-zinc-900">
        {!activeId && (
          <div className="flex h-full items-center justify-center px-4">
            <p className="text-center text-sm text-zinc-500">
              Open a project to start chatting
            </p>
          </div>
        )}

        {activeId && chat.length === 0 && !streaming && (
          <div className="mx-auto max-w-2xl space-y-4 px-3 py-6">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600">
                <span className="text-xl text-white">✨</span>
              </div>
              <h3 className="text-base font-semibold text-zinc-100">
                Welcome to RenovaAI
              </h3>
              <p className="mt-1 text-xs text-zinc-400">
                Your AI assistant for exterior home renovation
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2.5">
                <div className="mb-1 text-lg">💬</div>
                <h4 className="mb-0.5 text-xs font-medium text-zinc-100">Ask Questions</h4>
                <p className="text-[10px] text-zinc-400">
                  Get advice on materials, colors & maintenance
                </p>
              </div>
              
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2.5">
                <div className="mb-1 text-lg">🎨</div>
                <h4 className="mb-0.5 text-xs font-medium text-zinc-100">Generate Designs</h4>
                <p className="text-[10px] text-zinc-400">
                  AI-powered renovation visualizations
                </p>
              </div>
              
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2.5">
                <div className="mb-1 text-lg">✏️</div>
                <h4 className="mb-0.5 text-xs font-medium text-zinc-100">Design Preferences</h4>
                <p className="text-[10px] text-zinc-400">
                  Add your vision and style preferences
                </p>
              </div>
              
              <div className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-2.5">
                <div className="mb-1 text-lg">📊</div>
                <h4 className="mb-0.5 text-xs font-medium text-zinc-100">Cost Reports</h4>
                <p className="text-[10px] text-zinc-400">
                  Detailed estimates with quantities
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-2.5">
              <p className="mb-1 text-[10px] font-medium text-indigo-300">Try asking:</p>
              <div className="space-y-0.5 text-[10px] text-zinc-400">
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
                <div className="max-w-[80%] rounded-xl bg-indigo-600 px-3 py-2 text-xs leading-relaxed text-white">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-semibold text-white">
                  AI
                </div>
                <div className="min-w-0 flex-1 space-y-1 pt-0.5 text-xs text-zinc-100">
                  <Markdown text={m.content} />
                </div>
              </div>
            )
          )}

          {(streaming || generating || reporting) && (
            <div className="flex gap-2">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-semibold text-white">
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
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-3">
          <div className="mx-auto max-w-3xl space-y-2">
            {/* Design Preferences - FIRST */}
            {canGenerate && (
              <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-2">
                <label className="mb-1 block text-[11px] font-medium text-zinc-400">
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
                  className="w-full resize-none rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-indigo-500"
                  rows={2}
                />
                <p className="mt-1 text-right text-[10px] text-zinc-600">
                  {wordCount}/{maxWords} words
                </p>
              </div>
            )}

            {/* Action Buttons - SECOND */}
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={generate}
                disabled={!canGenerate || generating || streaming}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
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
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {reporting ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
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
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
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
                className="h-9 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-indigo-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
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
