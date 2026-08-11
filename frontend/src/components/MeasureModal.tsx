import { useEffect, useRef, useState } from 'react'
import Modal from './Modal'

interface Props {
  distPx: number
  onConfirm: (feet: number) => void
  onCancel: () => void
}

export default function MeasureModal({ distPx, onConfirm, onCancel }: Props) {
  const [feet, setFeet] = useState(() =>
    String(Math.max(1, Math.round(distPx * 0.1))),
  )
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  function submit() {
    const n = parseFloat(feet)
    if (Number.isFinite(n) && n > 0) onConfirm(n)
  }

  return (
    <Modal title="Set reference length" onClose={onCancel}>
      <p 
        className="mt-2 text-sm"
        style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
      >
        The selected line is{' '}
        <span style={{ fontWeight: 600, color: '#ffffff' }}>
          {distPx.toFixed(0)} px
        </span>
        . Enter its real-world length in feet:
      </p>
      <div className="mt-4 flex items-center gap-2">
        <input
          ref={inputRef}
          value={feet}
          onChange={(e) => setFeet(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit()
          }}
          type="number"
          min="0.1"
          step="0.1"
          inputMode="decimal"
          className="flex-1 px-3 py-2 text-sm outline-none"
          style={{
            borderRadius: '10px',
            border: '1px solid #2a2a2a',
            backgroundColor: '#1a1a1a',
            color: '#ffffff',
            fontFamily: 'Geist, Inter, sans-serif'
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = '#6366f1'}
          onBlur={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}
        />
        <span 
          className="text-sm"
          style={{ color: '#6a6a6a', fontFamily: 'Geist, Inter, sans-serif' }}
        >
          ft
        </span>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium transition"
          style={{
            borderRadius: '10px',
            border: '1px solid #2a2a2a',
            color: '#ffffff',
            backgroundColor: 'transparent',
            fontFamily: 'Geist, Inter, sans-serif'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#1a1a1a'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          Cancel
        </button>
        <button
          onClick={submit}
          className="px-4 py-2 text-sm font-medium transition"
          style={{
            borderRadius: '10px',
            backgroundColor: '#ffffff',
            color: '#0a0a0a',
            fontFamily: 'Geist, Inter, sans-serif'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e5e5'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
        >
          Save
        </button>
      </div>
    </Modal>
  )
}
