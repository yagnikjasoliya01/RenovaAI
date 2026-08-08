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

function BotAvatar() {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-[11px] text-white">
      ✦
    </div>
  )
}

function UserAvatar({ name }: { name: string }) {
  return (
    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[11px] font-semibold text-zinc-100">
      {(name || 'U').slice(0, 1).toUpperCase()}
    </div>
  )
}

export default function ChatPanel({ onClose, embedded = false }: Props) {
  const activeId = useStore((s) => s.activeId)
  const chatByProject = useStore((s) => s.chatByProject)
  const chat = activeId ? (chatByProject[activeId] ?? []) : []
  const chatPush = useStore((s) => s.chatPush)
  const setChat = useStore((s) => s.setChat)
  const generatedImage = useStore((s) => s.generatedImage)
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
  const bottomRef = useRef<HTMLDivElement>(null)

  const hasScale = !!scaleFt && !!scalePx
  const reportReady = !!activeId && !!reportHtml[activeId]

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chat.length, streamText, streaming])

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
    if (!activeId || generating) return
    
    setGenerating(true)
    try {
      const res = await generateProject(activeId)
      setGeneratedImage(res.generated_image)
      
      // Reload chat to show backend-saved messages
      const msgs = await getProjectChat(activeId)
      setChat(activeId, msgs)
    } catch (err) {
      chatPush(activeId, {
        role: 'assistant',
        content: `❌ Generation failed: ${err instanceof Error ? err.message : 'Unknown error'}\n\nPlease try again or check your AI API configuration.`,
      })
    } finally {
      setGenerating(false)
    }
  }

  async function report() {
    if (!activeId || reporting || !hasScale) return
    
    setReporting(true)
    try {
      const res = await generateReport(activeId, reportBody())
      setReportHtml((m) => ({ ...m, [activeId]: res.html }))
      
      // Reload chat to show backend-saved messages
      const msgs = await getProjectChat(activeId)
      setChat(activeId, msgs)
    } catch (err) {
      chatPush(activeId, {
        role: 'assistant',
        content: `❌ Report generation failed: ${err instanceof Error ? err.message : 'Unknown error'}\n\nPlease check:\n- Reference measurement is set\n- Regions are tagged\n- Materials are applied`,
      })
    } finally {
      setReporting(false)
    }
  }

  return (
    <aside
      className={`flex min-h-0 min-w-0 flex-1 flex-col ${
        embedded ? '' : 'border-l border-zinc-800'
      } bg-zinc-900/70`}
    >
      {!embedded && (
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
          <div className="flex items-center gap-2">
            <BotAvatar />
            <h2 className="text-sm font-semibold text-zinc-100">
              AI Assistant
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {streaming ? 'Typing…' : 'Online'}
            </span>
            {onClose && (
              <button
                onClick={onClose}
                title="Close chat"
                className="text-zinc-500 hover:text-zinc-200"
              >
                ✕
              </button>
            )}
          </div>
        </header>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {!activeId && (
          <p className="py-10 text-center text-[13px] text-zinc-500">
            Open a project to chat with your renovation assistant.
          </p>
        )}

        {chat.length === 0 && activeId && !streaming && (
          <div className="py-8 text-center">
            <BotAvatar />
            <p className="mt-3 text-[13px] text-zinc-300">
              Ask about materials, colors, durability or cost for this project.
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              e.g. “What exterior paint lasts longest in monsoon?”
            </p>
          </div>
        )}

        <div className="space-y-5">
          {chat.map((m, i) =>
            m.role === 'user' ? (
              <div key={i} className="flex justify-end gap-2">
                <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-zinc-100 px-3.5 py-2 text-[13px] leading-relaxed text-zinc-950">
                  {m.content}
                </div>
                <UserAvatar name="" />
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2.5">
                <BotAvatar />
                <div className="min-w-0 flex-1 pt-0.5">
                  <Markdown text={m.content} />
                </div>
              </div>
            )
          )}

          {(streaming || generating || reporting) && (
            <div className="flex items-start gap-2.5">
              <BotAvatar />
              <div className="min-w-0 flex-1 pt-0.5">
                {streamText ? (
                  <>
                    <Markdown text={streamText} />
                    <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse bg-zinc-400" />
                  </>
                ) : generating ? (
                  <div className="text-[13px] text-zinc-400">
                    <span className="flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:240ms]" />
                      </span>
                      Generating AI renovation...
                    </span>
                  </div>
                ) : reporting ? (
                  <div className="text-[13px] text-zinc-400">
                    <span className="flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:0ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:120ms]" />
                        <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500 [animation-delay:240ms]" />
                      </span>
                      Generating cost report...
                    </span>
                  </div>
                ) : (
                  <span className="flex gap-1 pt-1.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:240ms]" />
                  </span>
                )}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 border-t border-zinc-800 p-3">
        <button
          onClick={generate}
          disabled={!activeId || regions.length === 0 || generating || streaming}
          className="mb-2 w-full rounded-xl border border-zinc-700 py-2 text-[13px] font-medium text-zinc-200 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {generating ? 'Generating…' : 'Generate renovated image'}
        </button>
        {regions.length === 0 && activeId && (
          <p className="mb-2 text-center text-xs text-zinc-500">
            Tag regions &amp; pick materials to enable image generation
          </p>
        )}
        <button
          onClick={report}
          disabled={
            !activeId || !hasScale || regions.length === 0 || reporting || streaming
          }
          className="mb-2 w-full rounded-xl border border-indigo-500/40 bg-indigo-500/10 py-2 text-[13px] font-medium text-indigo-300 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {reporting ? 'Generating report…' : 'Generate cost report'}
        </button>
        {activeId && !hasScale && (
          <p className="mb-2 text-center text-xs text-zinc-500">
            Set a reference measurement (↔ tool) to generate a cost report
          </p>
        )}
        {activeId && hasScale && regions.length > 0 && !generatedImage && (
          <p className="mb-2 text-center text-xs text-amber-500/80">
            💡 Generate renovated image first for best results
          </p>
        )}
        {reportReady && (
          <button
            onClick={downloadReport}
            className="mb-2 w-full rounded-xl bg-zinc-100 py-2 text-[13px] font-semibold text-zinc-950 transition hover:bg-zinc-300"
          >
            Download report (.html)
          </button>
        )}
        <form onSubmit={send} className="flex items-end gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your renovation…"
            disabled={!activeId || streaming}
            className="min-h-[38px] flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-[13px] text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!activeId || streaming || !input.trim()}
            className="flex h-[38px] shrink-0 items-center justify-center rounded-xl bg-zinc-100 px-4 text-[13px] font-medium text-zinc-950 transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {streaming ? (
              <span className="flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:120ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:240ms]" />
              </span>
            ) : (
              'Send'
            )}
          </button>
        </form>
        <p className="mt-2 text-center text-[10px] text-zinc-600">
          RenovaAI may make mistakes — verify before spending.
        </p>
      </div>
    </aside>
  )
}
