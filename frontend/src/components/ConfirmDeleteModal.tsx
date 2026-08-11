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
      <p 
        className="mt-2 text-sm leading-relaxed"
        style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
      >
        <span style={{ fontWeight: 500, color: '#ffffff' }}>{projectName}</span> and all
        of its regions, chat history and generated image will be permanently
        deleted. This cannot be undone.
      </p>
      <div className="mt-5 flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 py-2.5 text-sm font-medium transition"
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
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            borderRadius: '10px',
            backgroundColor: loading ? '#7f1d1d' : '#ef4444',
            color: '#ffffff',
            fontFamily: 'Geist, Inter, sans-serif'
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#dc2626'
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#ef4444'
          }}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </button>
      </div>
    </Modal>
  )
}
