import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  onClose: () => void
}

export default function Modal({ title, children, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm p-6 shadow-2xl"
        style={{
          borderRadius: '16px',
          border: '1px solid #1a1a1a',
          backgroundColor: '#0f0f0f'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 
          className="text-lg font-semibold"
          style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
        >
          {title}
        </h2>
        {children}
      </div>
    </div>
  )
}
