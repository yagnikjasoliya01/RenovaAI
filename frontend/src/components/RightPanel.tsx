import { useState } from 'react'
import ChatPanel from './ChatPanel'
import CostPanel from './CostPanel'

type Tab = 'cost' | 'chat'

const TABS: { id: Tab; label: string }[] = [
  { id: 'cost', label: 'Cost estimate' },
  { id: 'chat', label: 'AI Assistant' },
]

export default function RightPanel() {
  const [tab, setTab] = useState<Tab>('cost')

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-l border-zinc-800 bg-zinc-900/70">
      <div className="flex h-9 shrink-0 items-center border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`h-full flex-1 text-xs font-medium transition ${
              tab === t.id
                ? 'border-b-2 border-zinc-100 text-zinc-100'
                : 'border-b-2 border-transparent text-zinc-500 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className={tab === 'cost' ? 'flex min-h-0 flex-1' : 'hidden'}>
          <CostPanel />
        </div>
        <div className={tab === 'chat' ? 'flex min-h-0 flex-1' : 'hidden'}>
          <ChatPanel embedded />
        </div>
      </div>
    </aside>
  )
}
