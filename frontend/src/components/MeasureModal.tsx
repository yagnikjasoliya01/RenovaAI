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
      <p className="mt-2 text-sm text-zinc-400">
        The selected line is{' '}
        <span className="font-semibold text-zinc-100">
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
          className="flex-1 rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
        />
        <span className="text-sm text-zinc-500">ft</span>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-xl border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          onClick={submit}
          className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-950 transition hover:bg-zinc-300"
        >
          Save
        </button>
      </div>
    </Modal>
  )
}
