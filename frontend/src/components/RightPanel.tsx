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
    <aside 
      className="flex min-h-0 flex-col overflow-hidden"
      style={{
        borderLeft: '1px solid #1a1a1a',
        backgroundColor: '#0f0f0f'
      }}
    >
      <div 
        className="flex h-9 shrink-0 items-center"
        style={{ borderBottom: '1px solid #1a1a1a' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="h-full flex-1 text-xs font-medium transition"
            style={{
              borderBottom: tab === t.id ? '2px solid #ffffff' : '2px solid transparent',
              color: tab === t.id ? '#ffffff' : '#6a6a6a',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
            onMouseEnter={(e) => {
              if (tab !== t.id) e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              if (tab !== t.id) e.currentTarget.style.color = '#6a6a6a'
            }}
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
