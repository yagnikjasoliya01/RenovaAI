import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { getMaterials, updateMaterialRates, resetMaterialRates } from '../api'
import type { Material } from '../types'
import ConfirmDialog from './ConfirmDialog'

interface Props {
  onClose: () => void
}

interface EditableMaterial extends Material {
  is_custom?: boolean
}

export default function MaterialRateEditor({ onClose }: Props) {
  const [materials, setMaterials] = useState<EditableMaterial[]>([])
  const [editedRates, setEditedRates] = useState<Record<string, { rate: number; labor_rate: number }>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)

  useEffect(() => {
    loadMaterials()
  }, [])

  const loadMaterials = async () => {
    try {
      const data = await getMaterials()
      setMaterials(data)
      setLoading(false)
    } catch (err: any) {
      toast.error(err.message || 'Failed to load materials')
      setLoading(false)
    }
  }

  const handleRateChange = (materialId: string, field: 'rate' | 'labor_rate', value: string) => {
    const numValue = parseFloat(value)
    if (isNaN(numValue) || numValue < 0) return

    const material = materials.find(m => m.id === materialId)
    if (!material) return

    setEditedRates(prev => ({
      ...prev,
      [materialId]: {
        rate: field === 'rate' ? numValue : (prev[materialId]?.rate ?? material.rate),
        labor_rate: field === 'labor_rate' ? numValue : (prev[materialId]?.labor_rate ?? material.labor_rate),
      },
    }))
  }

  const getCurrentRate = (material: EditableMaterial, field: 'rate' | 'labor_rate') => {
    if (editedRates[material.id]?.[field] !== undefined) {
      return editedRates[material.id][field]
    }
    return material[field]
  }

  const handleSave = async () => {
    setSaving(true)

    try {
      const updates = Object.entries(editedRates).map(([material_id, rates]) => {
        // Find the original material to get default values
        const material = materials.find(m => m.id === material_id)
        return {
          material_id,
          rate: rates.rate ?? material?.rate ?? 0,
          labor_rate: rates.labor_rate ?? material?.labor_rate ?? 0,
        }
      })

      await updateMaterialRates(updates)

      // Reload materials to show updated custom rates
      await loadMaterials()
      setEditedRates({})
      toast.success(`Successfully updated ${updates.length} material rate${updates.length !== 1 ? 's' : ''}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to save rates')
    } finally {
      setSaving(false)
    }
  }

  const handleResetConfirm = async () => {
    setSaving(true)

    try {
      await resetMaterialRates()
      await loadMaterials()
      setEditedRates({})
      setShowResetConfirm(false)
      toast.success('Successfully reset all rates to defaults')
    } catch (err: any) {
      toast.error(err.message || 'Failed to reset rates')
    } finally {
      setSaving(false)
    }
  }

  const hasChanges = Object.keys(editedRates).length > 0

  if (loading) {
    return (
      <div 
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
      >
        <div 
          className="p-8"
          style={{
            borderRadius: '12px',
            backgroundColor: '#0f0f0f',
            border: '1px solid #1a1a1a'
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="h-8 w-8 animate-spin rounded-full border-4"
              style={{
                borderColor: '#2a2a2a',
                borderTopColor: '#ffffff'
              }}
            />
            <p style={{ color: '#a1a1a1', fontFamily: 'Geist, Inter, sans-serif' }}>
              Loading materials...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.6)' }}
    >
      <div 
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
        style={{
          borderRadius: '16px',
          border: '1px solid #1a1a1a',
          backgroundColor: '#0f0f0f'
        }}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between p-4"
          style={{ borderBottom: '1px solid #1a1a1a' }}
        >
          <div>
            <h2 
              className="text-lg font-semibold"
              style={{ color: '#ffffff', fontFamily: 'Geist, Inter, sans-serif' }}
            >
              Material Rate Editor
            </h2>
            <p 
              className="text-sm"
              style={{ color: '#8f8f8f', fontFamily: 'Geist, Inter, sans-serif' }}
            >
              Customize material and labor costs
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 transition"
            style={{ borderRadius: '8px', color: '#8f8f8f' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#1a1a1a'
              e.currentTarget.style.color = '#ffffff'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent'
              e.currentTarget.style.color = '#8f8f8f'
            }}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Table */}
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full">
            <thead 
              className="sticky top-0 text-left text-sm font-semibold z-10"
              style={{ 
                backgroundColor: '#1a1a1a',
                color: '#a1a1a1',
                fontFamily: 'Geist, Inter, sans-serif'
              }}
            >
              <tr>
                <th className="p-3" style={{ borderBottom: '1px solid #2a2a2a' }}>Material</th>
                <th className="p-3" style={{ borderBottom: '1px solid #2a2a2a' }}>Category</th>
                <th className="p-3" style={{ borderBottom: '1px solid #2a2a2a' }}>Unit</th>
                <th className="p-3 text-right" style={{ borderBottom: '1px solid #2a2a2a' }}>Material Rate (₹)</th>
                <th className="p-3 text-right" style={{ borderBottom: '1px solid #2a2a2a' }}>Labor Rate (₹)</th>
              </tr>
            </thead>
            <tbody 
              className="text-sm"
              style={{ fontFamily: 'Geist, Inter, sans-serif' }}
            >
              {materials.map((material, index) => (
                <tr
                  key={material.id}
                  className="transition-colors"
                  style={{
                    borderBottom: '1px solid #1a1a1a',
                    backgroundColor: material.is_custom 
                      ? 'rgba(99, 102, 241, 0.05)' 
                      : index % 2 === 0 
                        ? 'transparent' 
                        : '#0a0a0a'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = material.is_custom ? 'rgba(99, 102, 241, 0.1)' : '#1a1a1a'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = material.is_custom 
                      ? 'rgba(99, 102, 241, 0.05)' 
                      : index % 2 === 0 
                        ? 'transparent' 
                        : '#0a0a0a'
                  }}
                >
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span style={{ color: '#ffffff' }}>{material.name}</span>
                      {material.is_custom && (
                        <span 
                          className="rounded-full px-2 py-0.5 text-xs"
                          style={{
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            color: '#a5b4fc'
                          }}
                        >
                          Custom
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 capitalize" style={{ color: '#8f8f8f' }}>{material.category}</td>
                  <td className="p-3" style={{ color: '#8f8f8f' }}>{material.unit}</td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={getCurrentRate(material, 'rate')}
                      onChange={(e) => handleRateChange(material.id, 'rate', e.target.value)}
                      disabled={saving}
                      className="w-24 px-2 py-1 text-right outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderRadius: '6px',
                        border: '1px solid #2a2a2a',
                        backgroundColor: '#0a0a0a',
                        color: '#ffffff',
                        fontFamily: 'Geist, Inter, sans-serif'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#6366f1'
                        e.currentTarget.style.boxShadow = '0 0 0 1px #6366f1'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#2a2a2a'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </td>
                  <td className="p-3">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={getCurrentRate(material, 'labor_rate')}
                      onChange={(e) => handleRateChange(material.id, 'labor_rate', e.target.value)}
                      disabled={saving}
                      className="w-24 px-2 py-1 text-right outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{
                        borderRadius: '6px',
                        border: '1px solid #2a2a2a',
                        backgroundColor: '#0a0a0a',
                        color: '#ffffff',
                        fontFamily: 'Geist, Inter, sans-serif'
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = '#6366f1'
                        e.currentTarget.style.boxShadow = '0 0 0 1px #6366f1'
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = '#2a2a2a'
                        e.currentTarget.style.boxShadow = 'none'
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div 
          className="flex items-center justify-between p-4"
          style={{ borderTop: '1px solid #1a1a1a' }}
        >
          <button
            onClick={() => setShowResetConfirm(true)}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium transition disabled:opacity-50"
            style={{
              borderRadius: '8px',
              border: '1px solid #2a2a2a',
              color: '#a1a1a1',
              backgroundColor: 'transparent',
              fontFamily: 'Geist, Inter, sans-serif'
            }}
            onMouseEnter={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = '#1a1a1a'
            }}
            onMouseLeave={(e) => {
              if (!saving) e.currentTarget.style.backgroundColor = 'transparent'
            }}
          >
            Reset to Defaults
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 text-sm font-medium transition disabled:opacity-50"
              style={{
                borderRadius: '8px',
                border: '1px solid #2a2a2a',
                color: '#a1a1a1',
                backgroundColor: 'transparent',
                fontFamily: 'Geist, Inter, sans-serif'
              }}
              onMouseEnter={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = '#1a1a1a'
              }}
              onMouseLeave={(e) => {
                if (!saving) e.currentTarget.style.backgroundColor = 'transparent'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="px-4 py-2 text-sm font-medium transition disabled:opacity-50"
              style={{
                borderRadius: '8px',
                backgroundColor: (!hasChanges || saving) ? '#2a2a2a' : '#6366f1',
                color: '#ffffff',
                fontFamily: 'Geist, Inter, sans-serif'
              }}
              onMouseEnter={(e) => {
                if (hasChanges && !saving) e.currentTarget.style.backgroundColor = '#4f46e5'
              }}
              onMouseLeave={(e) => {
                if (hasChanges && !saving) e.currentTarget.style.backgroundColor = '#6366f1'
              }}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <ConfirmDialog
          title="Reset Material Rates"
          message="Reset all material rates to defaults? This will remove all your custom pricing and cannot be undone."
          confirmText="Reset to Defaults"
          cancelText="Cancel"
          confirmVariant="danger"
          loading={saving}
          onConfirm={handleResetConfirm}
          onCancel={() => setShowResetConfirm(false)}
        />
      )}
    </div>
  )
}
