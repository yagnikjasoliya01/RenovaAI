import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  onClose: () => void
}

export default function Modal({ title, children, onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>
        {children}
      </div>
    </div>
  )
}
