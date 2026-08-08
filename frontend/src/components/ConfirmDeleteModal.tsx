import Modal from './Modal'

interface Props {
  projectName: string
  loading: boolean
  onConfirm: () => void
  onClose: () => void
}

export default function ConfirmDeleteModal({
  projectName,
  loading,
  onConfirm,
  onClose,
}: Props) {
  return (
    <Modal title="Delete project?" onClose={onClose}>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">
        <span className="font-medium text-zinc-200">{projectName}</span> and all
        of its regions, chat history and generated image will be permanently
        deleted. This cannot be undone.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-xl border border-zinc-700 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 rounded-xl bg-red-500/90 py-2.5 text-sm font-medium text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}
